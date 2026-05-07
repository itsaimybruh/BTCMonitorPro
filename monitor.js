const axios = require('axios');
const { Resend } = require('resend');
const fs = require('fs');

const resend = new Resend(process.env.RESEND_API_KEY);
const DATA_FILE = './baseline.json';

async function run() {
    try {
        // 1. Carica i dati salvati
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        // 2. Recupera prezzo BTC/EUR attuale
        const response = await axios.get('https://api.coinbase.com/v2/prices/BTC-EUR/spot');
        const currentPrice = parseFloat(response.data.data.amount);
        const currentTime = new Date();

        // Se è la prima esecuzione assoluta, inizializza e termina
        if (data.lastPrice === 0) {
            data.lastPrice = currentPrice;
            data.lastTimestamp = currentTime.toISOString();
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            console.log("Inizializzazione completata. Prezzo base:", currentPrice, "EUR");
            return;
        }

        // 3. Calcola variazione percentuale
        const diff = currentPrice - data.lastPrice;
        const percentageChange = (diff / data.lastPrice) * 100;

        console.log(`Prezzo Base: ${data.lastPrice} | Corrente: ${currentPrice} | Var: ${percentageChange.toFixed(2)}%`);

        // 4. Controlla se la soglia del 5% è superata (positiva o negativa)
        if (Math.abs(percentageChange) >= 5) {
            const direction = percentageChange > 0 ? "AUMENTO" : "CROLLO";
            const icon = percentageChange > 0 ? "🚀" : "⚠️";
            
            await resend.emails.send({
                from: 'BTC Monitor <onboarding@resend.dev>',
                to: 'itsaimybruh@gmail.com', // Sostituisci con la tua mail
                subject: `${icon} Alert BTC: ${percentageChange.toFixed(2)}%`,
                html: `
                    <h2>Rilevata variazione significativa</h2>
                    <p><strong>Tipo:</strong> ${direction}</p>
                    <p><strong>Variazione:</strong> ${percentageChange.toFixed(2)}%</p>
                    <p><strong>Prezzo Corrente:</strong> ${currentPrice.toLocaleString('it-IT')} EUR</p>
                    <hr>
                    <p><strong>Intervallo monitorato:</strong><br>
                    Da: ${new Date(data.lastTimestamp).toLocaleString('it-IT')}<br>
                    A: ${currentTime.toLocaleString('it-IT')}</p>
                `
            });

            // Aggiorna la baseline per il prossimo ciclo di monitoraggio
            data.lastPrice = currentPrice;
            data.lastTimestamp = currentTime.toISOString();
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            console.log("Email inviata e baseline aggiornata.");
        } else {
            console.log("Variazione inferiore al 5%. Nessuna azione intrapresa.");
        }

    } catch (error) {
        console.error("Errore:", error.message);
    }
}

run();
