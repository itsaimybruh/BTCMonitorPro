const axios = require('axios');
const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend(process.env.RESEND_API_KEY);
const BASELINE_FILE = './baseline.json';
const USER_DATA_FILE = './user_data.json';

async function run() {
    try {
        // 1. Leggi dati utente (Acquisti reali)
        const userData = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
        const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
        
        // 2. Prezzo attuale
        const response = await axios.get('https://api.coinbase.com/v2/prices/BTC-EUR/spot');
        const currentPrice = parseFloat(response.data.data.amount);
        const currentTime = new Date();

        // 3. Calcolo Portafoglio Reale
        const purchases = userData.purchases || [];
        const totalBtc = purchases.reduce((sum, p) => sum + p.btc, 0);
        const totalCost = purchases.reduce((sum, p) => sum + p.cost, 0);
        let currentPortfolioValue = (totalBtc * currentPrice) + 2.00; // Offset v12

        if (userData.cashSubtract && userData.cashAmount) {
            currentPortfolioValue -= userData.cashAmount;
        }

        const currentProfit = currentPortfolioValue - totalCost;
        const currentRoi = totalCost > 0 ? (currentProfit / totalCost) * 100 : 0;

        // 4. Logica Variazione (su BTC/EUR)
        if (baseline.lastPrice === 0) {
            baseline.lastPrice = currentPrice;
            baseline.lastTimestamp = currentTime.toISOString();
            fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
            return;
        }

        const diff = currentPrice - baseline.lastPrice;
        const percentageChange = (diff / baseline.lastPrice) * 100;

        if (Math.abs(percentageChange) >= 5) {
            await resend.emails.send({
                from: 'BTC Monitor <onboarding@resend.dev>',
                to: 'tua-email@esempio.it',
                subject: `Alert BTC: ${percentageChange.toFixed(2)}% (${currentPrice.toFixed(0)} EUR)`,
                html: `
                    <h2>Variazione BTC/EUR: ${percentageChange.toFixed(2)}%</h2>
                    <p><strong>Prezzo BTC:</strong> ${currentPrice.toLocaleString('it-IT')} EUR</p>
                    <hr>
                    <h3>Stato Portafoglio Reale:</h3>
                    <p><strong>Valore Totale:</strong> ${currentPortfolioValue.toLocaleString('it-IT')} EUR</p>
                    <p><strong>Profitto Netto:</strong> ${currentProfit.toLocaleString('it-IT')} EUR</p>
                    <p><strong>ROI:</strong> ${currentRoi.toFixed(2)}%</p>
                    <hr>
                    <p><small>Monitorato da: ${new Date(baseline.lastTimestamp).toLocaleString('it-IT')}</small></p>
                `
            });

            baseline.lastPrice = currentPrice;
            baseline.lastTimestamp = currentTime.toISOString();
            fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
        }
    } catch (error) {
        console.error("Errore:", error.message);
    }
}
run();
