
/* ==========================================
   PAOLO SPESE - GESTIONE CONTI
   Versione 0.3
   ========================================== */

const ACCOUNTS_STORAGE_KEY = "paolo-spese-accounts";

const DEFAULT_ACCOUNTS = [
    {
        id: "conto-principale",
        name: "Conto corrente principale",
        type: "bank",
        balance: 0
    },
    {
        id: "conto-secondario",
        name: "Conto corrente secondario",
        type: "bank",
        balance: 0
    },
    {
        id: "carta-prepagata",
        name: "Carta prepagata",
        type: "card",
        balance: 0
    },
    {
        id: "contanti",
        name: "Contanti",
        type: "cash",
        balance: 0
    }
];

function loadAccounts() {
    const saved = localStorage.getItem(ACCOUNTS_STORAGE_KEY);

    if (saved) {
        return JSON.parse(saved);
    }

    localStorage.setItem(
        ACCOUNTS_STORAGE_KEY,
        JSON.stringify(DEFAULT_ACCOUNTS)
    );

    return [...DEFAULT_ACCOUNTS];
}

function saveAccounts(accounts) {
    localStorage.setItem(
        ACCOUNTS_STORAGE_KEY,
        JSON.stringify(accounts)
    );
}

function addAccount(name, type, initialBalance = 0) {
    const accounts = loadAccounts();

    const account = {
        id: "account-" + Date.now(),
        name: name,
        type: type,
        balance: Number(initialBalance)
    };

    accounts.push(account);
    saveAccounts(accounts);

    return account;
}

function deleteAccount(id) {
    let accounts = loadAccounts();

    accounts = accounts.filter(
        account => account.id !== id
    );

    saveAccounts(accounts);
}

function updateAccountBalance(id, amount) {
    const accounts = loadAccounts();

    const account = accounts.find(
        item => item.id === id
    );

    if (!account) return;

    account.balance += Number(amount);

    saveAccounts(accounts);
}


/* ==========================================
   VISUALIZZAZIONE E GESTIONE CONTI
   ========================================== */

async function renderAccounts() {
    const accounts = loadAccounts();
    const container = document.getElementById("accounts-list");
    if (!container) return;
    container.innerHTML = "";
    const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
    let movements = [];
    try {
        if (typeof allMovements === "function" && typeof db !== "undefined" && db) movements = await allMovements();
    } catch (error) { console.warn("Impossibile calcolare i saldi dai movimenti:", error); }

    accounts.forEach(account => {
        const card = document.createElement("div");
        card.style.cssText = "background:white;border:1px solid #dce5e3;border-radius:14px;padding:20px;box-shadow:0 3px 10px rgba(0,0,0,.05);";
        const name = document.createElement("h3"); name.textContent = account.name;
        const types = { bank: "Conto corrente", card: "Carta", cash: "Contanti" };
        const type = document.createElement("p"); type.textContent = types[account.type] || "Altro";
        const balanceDate = account.balanceDate || "";
        const openingBalance = Number(account.balance || 0);
        const accountMovements = movements.filter(item => item.accountId === account.id && item.checked !== false && (!balanceDate || String(item.date || "") > balanceDate));
        const net = accountMovements.reduce((sum,item)=>sum+(item.type==="income"?Number(item.amount||0):-Number(item.amount||0)),0);
        const currentBalance = openingBalance + net;
        const balanceLabel = document.createElement("p");
        balanceLabel.textContent = balanceDate ? "Saldo aggiornato" : "Saldo provvisorio (da confermare)";
        balanceLabel.style.cssText="margin:14px 0 4px;color:#71817d;font-size:13px;";
        const balance = document.createElement("h2"); balance.textContent=euro.format(currentBalance); balance.style.cssText="color:#087f68;margin:0 0 14px;";
        const label=document.createElement("label"); label.textContent="Imposta saldo reale attuale (€)"; label.style.cssText="display:block;font-size:13px;font-weight:600;margin-bottom:6px;";
        const input=document.createElement("input"); input.type="number"; input.step="0.01"; input.inputMode="decimal"; input.value=openingBalance.toFixed(2); input.style.cssText="width:100%;box-sizing:border-box;padding:11px;border:1px solid #d5e0dc;border-radius:9px;margin-bottom:8px;";
        const save=document.createElement("button"); save.type="button"; save.textContent="Salva saldo reale"; save.style.cssText="background:#eaf4ef;color:#245b49;border:1px solid #d5e5dc;padding:9px 13px;border-radius:8px;cursor:pointer;font-weight:600;";
        save.addEventListener("click",()=>{
            const value=Number(String(input.value).replace(",","."));
            if(!Number.isFinite(value)){alert("Inserisci un saldo valido.");return;}
            const latest=loadAccounts(); const target=latest.find(item=>item.id===account.id); if(!target)return;
            target.balance=value; target.balanceDate=new Date().toISOString().slice(0,10); saveAccounts(latest);
            renderAccounts(); alert("Saldo reale salvato. Da domani verranno conteggiati i movimenti successivi contabilizzati.");
        });
        const hint=document.createElement("small");
        hint.textContent=balanceDate?"Movimenti successivi alla data di aggiornamento inclusi: "+accountMovements.length:"Inserisci il saldo che leggi oggi dalla banca o dall'app. I movimenti storici non saranno sommati dopo la conferma.";
        hint.style.cssText="display:block;color:#71817d;margin:2px 0 12px;line-height:1.4;";
        const remove=document.createElement("button"); remove.type="button"; remove.textContent="Elimina conto"; remove.style.cssText="margin-top:8px;background:#a83232;color:white;border:0;padding:9px 14px;border-radius:7px;cursor:pointer;";
        remove.addEventListener("click",()=>{if(confirm("Vuoi eliminare il conto "+account.name+"?")){deleteAccount(account.id);renderAccounts();}});
        card.append(name,type,balanceLabel,balance,label,input,save,hint,remove); container.appendChild(card);
    });
}

/* ==========================================
   INSERIMENTO NUOVO CONTO
   ========================================== */

function initializeAccounts() {

    const form = document.getElementById("account-form");

    if (!form) return;

    form.addEventListener("submit", function(event) {

        event.preventDefault();

        const name = document.getElementById("account-name").value.trim();

        const type = document.getElementById("account-type").value;

        const balance = Number(
            document.getElementById("account-balance").value
        );

        if (!name) {
            alert("Inserisci il nome del conto.");
            return;
        }

        if (!Number.isFinite(balance)) {
            alert("Inserisci un saldo iniziale valido.");
            return;
        }

        addAccount(name, type, balance);

        form.reset();

        document.getElementById("account-balance").value = 0;

        renderAccounts();

        alert("Conto aggiunto correttamente.");

    });

    renderAccounts();

}


/* ==========================================
   AVVIO GESTIONE CONTI
   ========================================== */

document.addEventListener(
    "DOMContentLoaded",
    initializeAccounts
);


/* ==========================================
   NAVIGAZIONE PAOLO SPESE
   ========================================== */


function showPage(page) {

    const pages = ["dashboard", "accounts", "movements", "statistics", "account-analysis", "budget", "settings"];
    if (!pages.includes(page)) return;

    // Nasconde tutte le sezioni e mostra solo quelle della pagina scelta.
    document.querySelectorAll("main > section, #page-accounts, #page-budget").forEach(section => {
        section.style.display = "none";
    });

    const idsByPage = {
        dashboard: ["page-dashboard"],
        accounts: ["page-accounts"],
        movements: ["page-movements-form", "page-movements-list"],
        statistics: ["page-statistics"],
        "account-analysis": ["page-account-analysis"],
        budget: ["page-budget"],
        settings: ["page-settings"]
    };

    idsByPage[page].forEach(id => {
        const section = document.getElementById(id);
        if (section) section.style.display = "";
    });

    document.querySelectorAll("#main-navigation button").forEach(button => {
        button.classList.remove("active");
        if (button.getAttribute("onclick") === "showPage('" + page + "')") {
            button.classList.add("active");
        }
    });
    if (page === "account-analysis" && typeof renderAccountAnalysis === "function" && typeof db !== "undefined" && db) {
        renderAccountAnalysis();
    }

    // Aggiorna il Budget ogni volta che si apre la relativa sezione.
    if (page === "budget" && typeof renderBudget === "function" && typeof db !== "undefined" && db) {
        renderBudget();
    }
}



/* Apertura iniziale sulla dashboard */

document.addEventListener("DOMContentLoaded", function() {
    showPage("dashboard");
});
