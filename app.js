
const DB_NAME = "paolo-spese-db";
const STORE = "movements";

const $ = id => document.getElementById(id);

const categories = {
    expense: [
        "Alimentari",
        "Casa",
        "Trasporti",
        "Salute",
        "Ristoranti",
        "Shopping",
        "Utenze",
        "Tempo libero",
        "Viaggi",
        "Altro"
    ],

    income: [
        "Stipendio",
        "Rimborsi",
        "Investimenti",
        "Emolumenti",
        "Buoni pasto",
        "Regali",
        "Altro"
    ]
};

let db;

// APERTURA DATABASE

function openDB() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {

            request.result.createObjectStore(
                STORE,
                {
                    keyPath: "id",
                    autoIncrement: true
                }
            );

        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });

}

// LETTURA MOVIMENTI

function allMovements() {

    return new Promise((resolve, reject) => {

        const request = db
            .transaction(STORE, "readonly")
            .objectStore(STORE)
            .getAll();

        request.onsuccess = () => {

            const data = request.result.sort((a, b) =>
                b.date.localeCompare(a.date) || b.id - a.id
            );

            resolve(data);

        };

        request.onerror = () => reject(request.error);

    });

}

// INSERIMENTO MOVIMENTO

function saveMovement(item) {

    return new Promise((resolve, reject) => {

        const request = db
            .transaction(STORE, "readwrite")
            .objectStore(STORE)
            .add(item);

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });

}

// CANCELLAZIONE MOVIMENTO

function updateMovement(item) {

    return new Promise((resolve, reject) => {

        const request = db.transaction(STORE, "readwrite")
            .objectStore(STORE).put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

    });

}

function deleteMovement(id) {

    return new Promise((resolve, reject) => {

        const request = db
            .transaction(STORE, "readwrite")
            .objectStore(STORE)
            .delete(Number(id));

        request.onsuccess = resolve;

        request.onerror = () => reject(request.error);

    });

}

// RIPRISTINO DATABASE

function replaceAll(items) {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(STORE, "readwrite");

        const store = transaction.objectStore(STORE);

        store.clear();

        items.forEach(({ id, ...item }) => {
            store.add(item);
        });

        transaction.oncomplete = resolve;

        transaction.onerror = () => reject(transaction.error);

    });

}

// FORMATO EURO

function euro(value) {
    // Formattazione italiana esplicita: 1.234,56 €
    // Evita differenze di Intl.NumberFormat tra WebView e Safari.
    const number = Number(value) || 0;
    const sign = number < 0 ? "−" : "";
    const fixed = Math.abs(number).toFixed(2);
    const parts = fixed.split(".");
    const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + integer + "," + parts[1] + " €";
}

// FORMATO DATA

function formatDate(value) {

    return new Date(value + "T12:00:00")
        .toLocaleDateString("it-IT");

}

// MESE CORRENTE

function currentMonth() {

    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");

}

// CATEGORIE DINAMICHE

function updateCategories() {

    const type = $("type").value;

    $("category").innerHTML =
        categories[type]
            .map(category =>
                `<option>${escapeHtml(category)}</option>`
            )
            .join("");

}

// PROTEZIONE TESTI VISUALIZZATI

function escapeHtml(value) {

    return String(value).replace(/[&<>"']/g, character => {

        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character];

    });

}


function refreshMovementAccounts(selectedId) {
    const select = $("movementAccount");
    if (!select) return;
    const accounts = loadAccounts();
    select.innerHTML = accounts.map(account => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`).join("");
    if (selectedId && accounts.some(account => account.id === selectedId)) select.value = selectedId;
}

function ensureImportAccount(id, name, type) {
    const accounts = loadAccounts();
    let account = accounts.find(item => item.id === id) || accounts.find(item => item.name.toLocaleLowerCase("it") === name.toLocaleLowerCase("it"));
    if (!account) { account = { id, name, type, balance: 0 }; accounts.push(account); saveAccounts(accounts); }
    return account.id;
}

function movementIsAccounted(item) { return item.checked !== false; }

// FILTRO MESE

function selectedMovements(items) {

    const month = $("monthFilter").value;

    if (!month) return items;

    return items.filter(item =>
        item.date.startsWith(month)
    );

}

// FILTRI AVANZATI DEL REGISTRO
let editingMovementId = null;

function populateMovementCategories(items) {
    const select = $("movementCategoryFilter");
    if (!select) return;
    const previous = select.value;
    const values = [...new Set(items.map(item => item.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, "it"));
    select.innerHTML = '<option value="">Tutte le categorie</option>' + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    if (values.includes(previous)) select.value = previous;
}

function applyMovementFilters(items) {
    const search = ($("movementSearch")?.value || "").trim().toLocaleLowerCase("it");
    const type = $("movementTypeFilter")?.value || "";
    const category = $("movementCategoryFilter")?.value || "";
    const from = $("movementFrom")?.value || "";
    const to = $("movementTo")?.value || "";
    return items.filter(item => {
        const text = `${item.description || ""} ${item.notes || ""} ${item.category || ""}`.toLocaleLowerCase("it");
        return (!search || text.includes(search)) && (!type || item.type === type) && (!category || item.category === category) && (!from || item.date >= from) && (!to || item.date <= to);
    });
}

function openNewMovement() {
    resetMovementEditor();
    $("formMessage").textContent = "";
    showPage("movements");
    const editorPage = $("page-movements-form");
    const registerPage = $("page-movements-list");
    if (editorPage) editorPage.style.display = "block";
    if (registerPage) registerPage.style.display = "block";
    $("movementForm").scrollIntoView({ behavior: "smooth", block: "start" });
    $("type").focus();
}

function startEditMovement(id, items) {
    const item = items.find(movement => movement.id === Number(id));
    if (!item) return;
    editingMovementId = item.id;
    $("type").value = item.type;
    updateCategories();
    if (![...$("category").options].some(option => option.value === item.category)) {
        const option = document.createElement("option"); option.value = item.category; option.textContent = item.category; $("category").appendChild(option);
    }
    $("category").value = item.category;
    $("amount").value = item.amount;
    $("description").value = item.description || "";
    $("date").value = item.date;
    $("payment").value = item.payment || "Altro";
    $("notes").value = item.notes || "";
    refreshMovementAccounts(item.accountId);
    $("movementChecked").checked = movementIsAccounted(item);
    const submit = $("movementForm").querySelector('button[type="submit"]');
    submit.textContent = "Salva modifiche";
    $("formMessage").textContent = "Stai modificando un movimento. Dopo il salvataggio tornerà nel registro.";
    showPage("movements");
    // Il modulo di inserimento/modifica ha un ID distinto dalla pagina registro.
    // Lo rendiamo esplicitamente visibile quando si avvia la modifica.
    const editorPage = $("page-movements-form");
    if (editorPage) editorPage.style.display = "block";
    const registerPage = $("page-movements-list");
    if (registerPage) registerPage.style.display = "block";
    $("movementForm").scrollIntoView({behavior:"smooth", block:"start"});
}

function resetMovementEditor() {
    editingMovementId = null;
    $("movementForm").reset();
    $("date").value = new Date().toISOString().slice(0,10);
    updateCategories();
    refreshMovementAccounts("conto-principale");
    if ($("movementChecked")) $("movementChecked").checked = true;
    $("movementForm").querySelector('button[type="submit"]').textContent = "Aggiungi movimento";
}

// GRAFICO USCITE PER CATEGORIA

function renderBreakdown(items) {

    const expenses = items.filter(
        item => item.type === "expense"
    );

    const sums = {};

    expenses.forEach(item => {

        sums[item.category] =
            (sums[item.category] || 0) + item.amount;

    });

    const entries = Object.entries(sums)
        .sort((a, b) => b[1] - a[1]);

    const total = expenses.reduce(
        (sum, item) => sum + item.amount, 0
    );

    $("categoryBreakdown").innerHTML = entries.length
        ? entries.map(([name, value]) => {

            const percentage = total
                ? value / total * 100
                : 0;

            return `
                <div class="break-row">

                    <strong>${escapeHtml(name)}</strong>

                    <div class="bar">
                        <span style="width:${percentage}%"></span>
                    </div>

                    <span>${euro(value)}</span>

                </div>
            `;

        }).join("")
        : '<p class="muted">Nessuna uscita nel periodo selezionato.</p>';

}

// MOVIMENTI RECENTI IN DASHBOARD

function renderRecentMovements(items) {

    const recent = items.slice(0, 5);
    const container = $("recentMovements");
    if (!container) return;

    container.innerHTML = recent.length
        ? recent.map(item => `
            <div class="recent-movement-row">
                <div class="recent-movement-main">
                    <span class="recent-movement-icon ${item.type === "income" ? "is-income" : "is-expense"}">${item.type === "income" ? "＋" : "−"}</span>
                    <div class="recent-movement-description">
                        <strong>${escapeHtml(item.description)}</strong>
                        <small>${formatDate(item.date)} · ${escapeHtml(item.category)}</small>
                    </div>
                </div>
                <strong class="recent-movement-amount ${item.type === "income" ? "positive" : "negative"}">${item.type === "income" ? "+" : "−"}${euro(item.amount)}</strong>
            </div>
        `).join("")
        : '<p class="muted">Non ci sono ancora movimenti registrati.</p>';
}

// AGGIORNAMENTO DASHBOARD

async function render() {

    const all = await allMovements();

    const items = selectedMovements(all);
    const accountedItems = items.filter(movementIsAccounted);

    renderRecentMovements(all);

    const income = accountedItems
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const expense = accountedItems
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    $("income").textContent = euro(income);

    $("expense").textContent = euro(expense);

    const accounts = typeof loadAccounts === "function" ? loadAccounts() : [];
    const totalRealBalance = accounts
        .filter(account => account.id !== "conto-buoni-pasto" && !String(account.name || "").toLocaleLowerCase("it").includes("buoni pasto"))
        .reduce((total, account) => {
            const baseBalance = Number(account.balance || 0);
            const fromDate = account.balanceDate || "";
            const accountNet = all
                .filter(item => item.accountId === account.id && movementIsAccounted(item) && (!fromDate || String(item.date || "") > fromDate))
                .reduce((sum, item) => sum + (item.type === "income" ? Number(item.amount || 0) : -Number(item.amount || 0)), 0);
            return total + baseBalance + accountNet;
        }, 0);
    $("balance").textContent = euro(totalRealBalance);

    $("periodLabel").textContent =
        $("monthFilter").value
            ? new Date(
                $("monthFilter").value + "-02"
              ).toLocaleDateString("it-IT", {
                month: "long",
                year: "numeric"
              })
            : "Tutti i movimenti";

    // REGISTRO MOVIMENTI: filtri indipendenti da riepilogo e statistiche
    populateMovementCategories(all);
    const listedItems = applyMovementFilters(items);
    const sortOrder = $("movementSort")?.value || "desc";
    listedItems.sort((a, b) => {
        const byDate = String(a.date || "").localeCompare(String(b.date || ""));
        return sortOrder === "asc" ? byDate || (a.id - b.id) : -byDate || (b.id - a.id);
    });

    $("movementRows").innerHTML = listedItems.length

        ? listedItems.map(item => `

            <tr>

                <td>${formatDate(item.date)}</td>

                <td>
                    <strong>${escapeHtml(item.description)}</strong>
                    ${item.notes
                        ? `<br><small>${escapeHtml(item.notes)}</small>`
                        : ""}
                </td>

                <td>${escapeHtml(item.category)}</td>

                <td>${escapeHtml(item.payment)}</td>

                <td><span class="movement-status ${movementIsAccounted(item) ? "is-accounted" : "is-planned"}">${movementIsAccounted(item) ? "Contabilizzato" : "Programmato"}</span></td>

                <td class="num ${
                    item.type === "income"
                        ? "positive"
                        : "negative"
                }">

                    ${item.type === "income" ? "+" : "−"}
                    ${euro(item.amount)}

                </td>

                <td class="movement-actions">
                    <button type="button" class="edit" data-edit="${item.id}" aria-label="Modifica movimento">Modifica</button>
                    <button type="button" class="delete" data-delete="${item.id}" aria-label="Elimina movimento">×</button>
                </td>

            </tr>

        `).join("")

        : `
            <tr>
                <td colspan="7" class="empty">
                    Nessun movimento corrisponde ai filtri selezionati.
                </td>
            </tr>
        `;

    const count = $("movementCount");
    if (count) count.textContent = `${listedItems.length} moviment${listedItems.length === 1 ? "o" : "i"} visualizzat${listedItems.length === 1 ? "o" : "i"}`;

    renderBreakdown(accountedItems);

}

// CAMBIO TIPO MOVIMENTO


// ======================================
// ANALISI CONTI: SINGOLO CONTO E CONFRONTO
// ======================================

function analysisDateRange(items) {
    const from = $("analysisFrom")?.value || "";
    const to = $("analysisTo")?.value || "";
    return items.filter(item => (!from || item.date >= from) && (!to || item.date <= to));
}

function analysisStatusFilter(items) {
    const status = $("analysisStatus")?.value || "accounted";
    if (status === "planned") return items.filter(item => !movementIsAccounted(item));
    if (status === "accounted") return items.filter(movementIsAccounted);
    return items;
}

function analysisAccountName(account) {
    return account.name || account.id;
}

function isMealVoucherAccount(account) {
    return account.id === "conto-buoni-pasto" ||
        String(account.name || "").toLocaleLowerCase("it").includes("buoni pasto");
}

function accountCurrentBalance(account, allItems) {
    const base = Number(account.balance || 0);
    const baselineDate = account.balanceDate || "";
    const delta = allItems
        .filter(item => item.accountId === account.id && movementIsAccounted(item) &&
            (!baselineDate || String(item.date || "") > baselineDate))
        .reduce((sum, item) => sum + (item.type === "income" ? Number(item.amount || 0) : -Number(item.amount || 0)), 0);
    return base + delta;
}

function analysisSummaryCards(items) {
    const income = items.filter(x => x.type === "income").reduce((s,x)=>s+Number(x.amount||0),0);
    const expense = items.filter(x => x.type === "expense").reduce((s,x)=>s+Number(x.amount||0),0);
    const net = income-expense;
    return `
      <div class="analysis-kpis">
        <article class="analysis-kpi"><span>Entrate</span><strong class="positive">${euro(income)}</strong><small>${items.filter(x=>x.type==="income").length} operazioni</small></article>
        <article class="analysis-kpi"><span>Uscite</span><strong class="negative">${euro(expense)}</strong><small>${items.filter(x=>x.type==="expense").length} operazioni</small></article>
        <article class="analysis-kpi"><span>Saldo netto del periodo</span><strong class="${net>=0?"positive":"negative"}">${euro(net)}</strong><small>${items.length} movimenti inclusi</small></article>
      </div>`;
}

function renderSingleAccountAnalysis(account, periodItems, allItems) {
    const container=$("singleAccountAnalysis");
    if(!account){container.innerHTML='<p class="muted">Non sono presenti conti da analizzare.</p>';return;}
    const current=accountCurrentBalance(account,allItems);
    const expenses=periodItems.filter(x=>x.type==="expense");
    const categoryTotals={};
    expenses.forEach(x=>categoryTotals[x.category||"Senza categoria"]=(categoryTotals[x.category||"Senza categoria"]||0)+Number(x.amount||0));
    const categories=Object.entries(categoryTotals).sort((a,b)=>b[1]-a[1]);
    const maxCat=categories.length?categories[0][1]:0;
    const monthly={};
    periodItems.forEach(x=>{
        const key=(x.date||"").slice(0,7);
        if(!key)return;
        if(!monthly[key])monthly[key]={income:0,expense:0};
        monthly[key][x.type==="income"?"income":"expense"]+=Number(x.amount||0);
    });
    const months=Object.entries(monthly).sort((a,b)=>a[0].localeCompare(b[0]));
    const monthRows=months.map(([key,v])=>`<tr><td>${new Date(key+"-02").toLocaleDateString("it-IT",{month:"long",year:"numeric"})}</td><td class="positive">${euro(v.income)}</td><td class="negative">${euro(v.expense)}</td><td>${euro(v.income-v.expense)}</td></tr>`).join("");
    const movementRows=periodItems.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.id-a.id)).slice(0,30).map(x=>`<tr><td>${formatDate(x.date)}</td><td>${escapeHtml(x.description||"")}</td><td>${escapeHtml(x.category||"")}</td><td>${movementIsAccounted(x)?'<span class="movement-status is-accounted">Contabilizzato</span>':'<span class="movement-status is-planned">Programmato</span>'}</td><td class="${x.type==="income"?"positive":"negative"}">${x.type==="income"?"+":"−"}${euro(x.amount)}</td></tr>`).join("");
    container.innerHTML=`
      <div class="analysis-current-balance"><span>Saldo attuale del conto</span><strong>${euro(current)}</strong><small>Saldo reale iniziale più movimenti contabilizzati successivi alla data di aggiornamento</small></div>
      ${analysisSummaryCards(periodItems)}
      <div class="analysis-detail-grid">
        <div class="analysis-detail-card"><h4>Uscite per categoria</h4>
          ${categories.length?categories.map(([name,value])=>`<div class="analysis-category-row"><div><strong>${escapeHtml(name)}</strong><span>${euro(value)}</span></div><div class="analysis-track"><i style="width:${maxCat?value/maxCat*100:0}%"></i></div></div>`).join(""):'<p class="muted">Nessuna uscita nel periodo.</p>'}
        </div>
        <div class="analysis-detail-card"><h4>Andamento mensile</h4>
          ${months.length?`<div class="table-wrap"><table><thead><tr><th>Mese</th><th>Entrate</th><th>Uscite</th><th>Netto</th></tr></thead><tbody>${monthRows}</tbody></table></div>`:'<p class="muted">Nessun movimento nel periodo.</p>'}
        </div>
      </div>
      <div class="analysis-detail-card analysis-movements-card"><h4>Movimenti di riferimento ${periodItems.length>30?"(ultimi 30)":""}</h4>
        ${periodItems.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th>Stato</th><th>Importo</th></tr></thead><tbody>${movementRows}</tbody></table></div>`:'<p class="muted">Nessun movimento corrispondente ai filtri.</p>'}
      </div>`;
}

function renderAccountsComparison(accounts, allItems, filteredItems) {
    const container=$("accountsComparison");
    const rows=accounts.map(account=>{
        const period=filteredItems.filter(x=>x.accountId===account.id);
        const income=period.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount||0),0);
        const expense=period.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount||0),0);
        const net=income-expense;
        const current=accountCurrentBalance(account,allItems);
        return {account,period,income,expense,net,current};
    });
    const totalPatrimonial=rows.filter(x=>!isMealVoucherAccount(x.account)).reduce((s,x)=>s+x.current,0);
    const body=rows.map(x=>`<tr><td><strong>${escapeHtml(analysisAccountName(x.account))}</strong>${isMealVoucherAccount(x.account)?'<br><small>Escluso dal saldo patrimoniale</small>':""}</td><td>${euro(x.current)}</td><td class="positive">${euro(x.income)}</td><td class="negative">${euro(x.expense)}</td><td class="${x.net>=0?"positive":"negative"}">${euro(x.net)}</td><td>${x.period.length}</td></tr>`).join("");
    container.innerHTML=`
      <div class="analysis-current-balance comparison-total"><span>Saldo patrimoniale complessivo (esclusi Buoni Pasto)</span><strong>${euro(totalPatrimonial)}</strong></div>
      <div class="table-wrap"><table class="comparison-table"><thead><tr><th>Conto</th><th>Saldo attuale</th><th>Entrate periodo</th><th>Uscite periodo</th><th>Saldo netto periodo</th><th>Movimenti</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

async function renderAccountAnalysis() {
    const selector=$("analysisAccount");
    if(!selector)return;
    const accounts=typeof loadAccounts==="function"?loadAccounts():[];
    const previous=selector.value;
    selector.innerHTML=accounts.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(analysisAccountName(a))}</option>`).join("");
    if(accounts.some(a=>a.id===previous))selector.value=previous;
    const all=await allMovements();
    const statusItems=analysisStatusFilter(all);
    const periodItems=analysisDateRange(statusItems);
    const selected=accounts.find(a=>a.id===selector.value)||accounts[0];
    renderSingleAccountAnalysis(selected,periodItems.filter(x=>x.accountId===selected?.id),all);
    renderAccountsComparison(accounts,all,periodItems);
}



// ======================================
// BUDGET MENSILE PER CATEGORIA
// ======================================

const BUDGET_STORAGE_KEY = "paolo-spese-budgets";
let editingBudgetCategory = null;

function loadBudgets() {
    try {
        const saved = JSON.parse(localStorage.getItem(BUDGET_STORAGE_KEY) || "{}");
        return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (error) {
        console.warn("Archivio budget non leggibile:", error);
        return {};
    }
}

function saveBudgets(data) {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(data));
}

function budgetMonthValue() {
    return $("budgetMonth")?.value || currentMonth();
}

function budgetMonthLabel(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return month;
    return new Date(month + "-02").toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

function budgetAmountValue(value) {
    const amount = Number(String(value ?? "").trim().replace(",", "."));
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : NaN;
}

function budgetActualsForMonth(month, movements) {
    const totals = {};
    movements.forEach(item => {
        if (item.type !== "expense" || !movementIsAccounted(item) || !String(item.date || "").startsWith(month)) return;
        const category = item.category || "Senza categoria";
        totals[category] = (totals[category] || 0) + Number(item.amount || 0);
    });
    return totals;
}

function renderBudget() {
    const month = budgetMonthValue();
    const year = month.slice(0, 4);
    const allBudgets = loadBudgets();
    const monthBudgets = allBudgets[month] || {};
    const categoriesList = [...categories.expense];
    const categorySelect = $("budgetCategory");
    if (categorySelect) {
        const previous = categorySelect.value;
        categorySelect.innerHTML = categoriesList.map(name =>
            `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
        ).join("");
        if (categoriesList.includes(previous)) categorySelect.value = previous;
    }

    allMovements().then(movements => {
        // Il mese potrebbe essere cambiato mentre i movimenti venivano letti.
        if (budgetMonthValue() !== month) return;
        const actuals = budgetActualsForMonth(month, movements);
        const entries = Object.entries(monthBudgets)
            .filter(([category, amount]) => categoriesList.includes(category) && Number.isFinite(Number(amount)) && Number(amount) > 0)
            .sort((a, b) => a[0].localeCompare(b[0], "it"));
        const totalBudget = entries.reduce((sum, [, amount]) => sum + Number(amount), 0);
        const totalSpent = entries.reduce((sum, [category]) => sum + Number(actuals[category] || 0), 0);
        const remaining = totalBudget - totalSpent;
        const percent = totalBudget > 0 ? totalSpent / totalBudget * 100 : 0;

        $("budgetSummary").innerHTML = `
            <article class="budget-summary-card"><span>Budget totale</span><strong>${euro(totalBudget)}</strong></article>
            <article class="budget-summary-card"><span>Speso nelle categorie a budget</span><strong class="negative">${euro(totalSpent)}</strong></article>
            <article class="budget-summary-card"><span>${remaining >= 0 ? "Disponibilità residua" : "Superamento"}</span><strong class="${remaining >= 0 ? "positive" : "negative"}">${euro(Math.abs(remaining))}</strong></article>
            <article class="budget-summary-card"><span>Utilizzo complessivo</span><strong class="${percent >= 100 ? "negative" : percent >= 80 ? "budget-warning-text" : "positive"}">${percent.toFixed(1).replace(".", ",")}%</strong></article>
        `;

        if (!entries.length) {
            $("budgetCategoryList").innerHTML = '<div class="budget-empty">Non hai ancora impostato budget per questo mese. Seleziona una categoria e inserisci il relativo limite.</div>';
        } else {
            $("budgetCategoryList").innerHTML = entries.map(([category, amount]) => {
                const limit = Number(amount);
                const spent = Number(actuals[category] || 0);
                const left = limit - spent;
                const ratio = limit > 0 ? spent / limit * 100 : 0;
                const width = Math.min(100, Math.max(0, ratio));
                const state = ratio >= 100 ? "over" : ratio >= 80 ? "warning" : "good";
                const stateLabel = ratio >= 100 ? "Budget superato" : ratio >= 80 ? "Attenzione: oltre l'80%" : "Entro il limite";
                return `
                    <article class="budget-category-card">
                        <div class="budget-category-top">
                            <div><strong>${escapeHtml(category)}</strong><small>${stateLabel}</small></div>
                            <div class="budget-category-values"><strong>${euro(spent)}</strong><span>su ${euro(limit)}</span></div>
                        </div>
                        <div class="budget-progress ${state}"><span style="width:${width}%"></span></div>
                        <div class="budget-category-bottom">
                            <span>${ratio.toFixed(1).replace(".", ",")}% utilizzato</span>
                            <strong class="${left >= 0 ? "positive" : "negative"}">${left >= 0 ? "Residuo " : "Oltre di "}${euro(Math.abs(left))}</strong>
                        </div>
                        <div class="budget-row-actions">
                            <button type="button" class="ghost" data-budget-edit="${escapeHtml(category)}">Modifica</button>
                            <button type="button" class="budget-delete" data-budget-delete="${escapeHtml(category)}">Elimina</button>
                        </div>
                    </article>`;
            }).join("");
        }

        // Riepilogo annuale: somma dei budget mensili effettivamente impostati.
        const annualRows = [];
        for (let m = 1; m <= 12; m++) {
            const key = `${year}-${String(m).padStart(2, "0")}`;
            const monthEntries = Object.entries(allBudgets[key] || {})
                .filter(([category, amount]) => categoriesList.includes(category) && Number(amount) > 0);
            const budgetTotal = monthEntries.reduce((sum, [, amount]) => sum + Number(amount), 0);
            const monthActuals = budgetActualsForMonth(key, movements);
            const spentTotal = monthEntries.reduce((sum, [category]) => sum + Number(monthActuals[category] || 0), 0);
            if (budgetTotal > 0 || spentTotal > 0) {
                const ratio = budgetTotal > 0 ? spentTotal / budgetTotal * 100 : 0;
                annualRows.push(`<tr><td>${new Date(key + "-02").toLocaleDateString("it-IT", { month: "long" })}</td><td>${euro(budgetTotal)}</td><td class="negative">${euro(spentTotal)}</td><td class="${budgetTotal - spentTotal >= 0 ? "positive" : "negative"}">${euro(budgetTotal - spentTotal)}</td><td>${budgetTotal ? ratio.toFixed(1).replace(".", ",") + "%" : "—"}</td></tr>`);
            }
        }
        $("budgetYearSummary").innerHTML = annualRows.length
            ? `<div class="table-wrap"><table class="budget-year-table"><thead><tr><th>Mese</th><th>Budget</th><th>Spese</th><th>Differenza</th><th>Utilizzo</th></tr></thead><tbody>${annualRows.join("")}</tbody></table></div>`
            : '<p class="budget-empty">Non sono ancora presenti budget o spese contabilizzate per questo anno.</p>';
    }).catch(error => {
        console.error("Errore nel caricamento del budget:", error);
        $("budgetCategoryList").innerHTML = '<p class="muted">Impossibile caricare i movimenti per il budget.</p>';
    });
}

function resetBudgetEditor() {
    editingBudgetCategory = null;
    $("budgetForm")?.reset();
    $("budgetAmount").value = "";
    $("budgetCategory").disabled = false;
    $("budgetForm").querySelector('button[type="submit"]').textContent = "Salva budget";
    $("budgetCancelEdit").hidden = true;
}

$("budgetMonth")?.addEventListener("change", () => {
    resetBudgetEditor();
    renderBudget();
});

$("budgetForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const month = budgetMonthValue();
    const category = $("budgetCategory").value;
    const amount = budgetAmountValue($("budgetAmount").value);
    if (!category || !Number.isFinite(amount) || amount <= 0) {
        alert("Inserisci un limite mensile maggiore di zero.");
        return;
    }
    const budgets = loadBudgets();
    if (!budgets[month] || typeof budgets[month] !== "object") budgets[month] = {};
    budgets[month][category] = amount;
    saveBudgets(budgets);
    $("budgetMessage").textContent = `Budget ${category} salvato per ${budgetMonthLabel(month)}.`;
    resetBudgetEditor();
    renderBudget();
});

$("budgetCancelEdit")?.addEventListener("click", resetBudgetEditor);

$("budgetCategoryList")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-budget-edit]");
    if (edit) {
        const category = edit.dataset.budgetEdit;
        const budget = loadBudgets()[budgetMonthValue()] || {};
        editingBudgetCategory = category;
        $("budgetCategory").value = category;
        $("budgetCategory").disabled = true;
        $("budgetAmount").value = Number(budget[category] || 0).toFixed(2);
        $("budgetForm").querySelector('button[type="submit"]').textContent = "Aggiorna budget";
        $("budgetCancelEdit").hidden = false;
        $("budgetAmount").focus();
        return;
    }
    const remove = event.target.closest("[data-budget-delete]");
    if (remove) {
        const category = remove.dataset.budgetDelete;
        if (!confirm(`Vuoi eliminare il budget ${category} di ${budgetMonthLabel(budgetMonthValue())}?`)) return;
        const budgets = loadBudgets();
        if (budgets[budgetMonthValue()]) {
            delete budgets[budgetMonthValue()][category];
            if (!Object.keys(budgets[budgetMonthValue()]).length) delete budgets[budgetMonthValue()];
            saveBudgets(budgets);
        }
        if (editingBudgetCategory === category) resetBudgetEditor();
        renderBudget();
    }
});


$("type").addEventListener("change", updateCategories);

// FILTRO MENSILE

$("monthFilter").value = currentMonth();

$("monthFilter").addEventListener("change", render);
$("movementSort")?.addEventListener("change", render);
["analysisAccount","analysisFrom","analysisTo","analysisStatus"].forEach(id => {
    $(id)?.addEventListener("change", renderAccountAnalysis);
});
$("analysisReset")?.addEventListener("click", () => {
    $("analysisFrom").value = "";
    $("analysisTo").value = "";
    $("analysisStatus").value = "accounted";
    renderAccountAnalysis();
});

["movementSearch", "movementTypeFilter", "movementCategoryFilter", "movementFrom", "movementTo"].forEach(id => {
    $(id).addEventListener(id === "movementSearch" ? "input" : "change", render);
});

$("clearFilter").addEventListener("click", () => {
    $("monthFilter").value = "";
    $("movementSearch").value = "";
    $("movementTypeFilter").value = "";
    $("movementCategoryFilter").value = "";
    $("movementFrom").value = "";
    $("movementTo").value = "";
    render();
});

// ELIMINAZIONE MOVIMENTO

$("movementRows").addEventListener("click", async event => {

    const editButton = event.target.closest("[data-edit]");
    if (editButton) {
        const all = await allMovements();
        startEditMovement(editButton.dataset.edit, all);
        return;
    }

    const button = event.target.closest("[data-delete]");
    if (!button) return;

    if (confirm("Vuoi eliminare questo movimento?")) {

        await deleteMovement(button.dataset.delete);

        render();

    }

});

// SALVATAGGIO MOVIMENTO

$("movementForm").addEventListener("submit", async event => {

    event.preventDefault();

    const amount = Number($("amount").value);

    const description = $("description").value.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Inserisci un importo valido.");
        return;
    }

    if (!description) {
        alert("Inserisci una descrizione.");
        return;
    }

    const movementData = {

        type: $("type").value,

        amount: Math.round(amount * 100) / 100,

        description,

        category: $("category").value,

        date: $("date").value,

        payment: $("payment").value,
        accountId: $("movementAccount").value || "conto-principale",
        checked: $("movementChecked").checked,
        notes: $("notes").value.trim(),
        createdAt: new Date().toISOString()

    };

    if (editingMovementId !== null) {
        movementData.id = editingMovementId;
        const original = (await allMovements()).find(item => item.id === editingMovementId);
        if (original?.createdAt) movementData.createdAt = original.createdAt;
        if (original?.accountId && !movementData.accountId) movementData.accountId = original.accountId;
        await updateMovement(movementData);
        resetMovementEditor();
        $("formMessage").textContent = "Modifiche salvate correttamente.";
    } else {
        await saveMovement(movementData);
        resetMovementEditor();
        $("formMessage").textContent = "Movimento salvato.";
    }

    setTimeout(() => {
        $("formMessage").textContent = "";
    }, 2500);

    render();

    const editorPage = $("page-movements-form");
    if (editorPage) editorPage.style.display = "none";
    const registerPage = $("page-movements-list");
    if (registerPage) registerPage.style.display = "block";
    if (registerPage) registerPage.scrollIntoView({ behavior: "smooth", block: "start" });

});

// STATO E PROMEMORIA BACKUP
const LAST_BACKUP_KEY = "paolo-spese-last-backup";
const BACKUP_REMINDER_DAYS = 7;

function formatBackupTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function renderBackupStatus() {
    const status = $("backupStatus");
    if (!status) return;

    const savedAt = localStorage.getItem(LAST_BACKUP_KEY);
    const formatted = savedAt ? formatBackupTimestamp(savedAt) : null;

    if (!formatted) {
        status.classList.add("is-warning");
        status.textContent =
            "Nessun backup completo registrato da questa versione. Ti consigliamo di esportarne uno e salvarlo in iCloud Drive.";
        return;
    }

    const elapsedDays = (Date.now() - new Date(savedAt).getTime()) / 86400000;
    if (elapsedDays >= BACKUP_REMINDER_DAYS) {
        status.classList.add("is-warning");
        status.textContent =
            `Backup da aggiornare: ultimo backup esportato il ${formatted}. Ti consigliamo di crearne uno nuovo e salvarlo in iCloud Drive.`;
    } else {
        status.classList.remove("is-warning");
        status.textContent =
            `Ultimo backup completo esportato: ${formatted}. Ricordati di conservare il file in iCloud Drive.`;
    }
}

// ESPORTAZIONE BACKUP JSON

$("exportBtn").addEventListener("click", async () => {

    const data = {
        app: "Paolo Spese",
        version: 3,
        exportedAt: new Date().toISOString(),
        movements: await allMovements(),
        // I conti sono salvati in localStorage, separatamente dai movimenti.
        accounts: loadAccounts(),
        budgets: loadBudgets()
    };

    downloadBlob(
        JSON.stringify(data, null, 2),
        "paolo-spese-backup.json",
        "application/json"
    );

    localStorage.setItem(LAST_BACKUP_KEY, data.exportedAt);
    renderBackupStatus();

});

// ESPORTAZIONE CSV

$("csvBtn").addEventListener("click", async () => {

    const movements = await allMovements();

    const rows = [

        [
            "Data",
            "Tipo",
            "Descrizione",
            "Categoria",
            "Metodo",
            "Importo",
            "Note"
        ],

        ...movements.map(item => [

            item.date,
            item.type,
            item.description,
            item.category,
            item.payment,
            String(item.amount).replace(".", ","),
            item.notes || ""

        ])

    ];

    const csv = "\uFEFF" + rows.map(row =>

        row.map(value =>
            `"${String(value).replace(/"/g, '""')}"`
        ).join(";")

    ).join("\r\n");

    downloadBlob(
        csv,
        "paolo-spese-movimenti.csv",
        "text/csv;charset=utf-8"
    );

});

// RIPRISTINO BACKUP

$("importFile").addEventListener("change", async event => {

    const file = event.target.files[0];

    if (!file) return;

    try {

        const data = JSON.parse(await file.text());

        if (!Array.isArray(data.movements)) {
            throw new Error("Backup non valido: movimenti mancanti");
        }

        // I backup precedenti non contengono accounts: in quel caso i conti
        // già presenti sul dispositivo vengono lasciati invariati.
        if (data.accounts !== undefined) {
            if (!Array.isArray(data.accounts) || data.accounts.some(account =>
                !account || typeof account.name !== "string" ||
                !["bank", "card", "cash"].includes(account.type) ||
                !Number.isFinite(Number(account.balance))
            )) {
                throw new Error("Backup non valido: conti");
            }
        }

        const includesAccounts = Array.isArray(data.accounts);
        if (data.budgets !== undefined && (!data.budgets || typeof data.budgets !== "object" || Array.isArray(data.budgets))) {
            throw new Error("Backup non valido: budget");
        }
        const includesBudgets = data.budgets !== undefined;
        const message = "Il ripristino sostituirà i movimenti" +
            (includesAccounts ? ", i conti" : "") +
            (includesBudgets ? " e i budget" : "") +
            " presenti. Continuare?";

        if (!confirm(message)) return;

        await replaceAll(data.movements);

        if (data.exportedAt && formatBackupTimestamp(data.exportedAt)) {
            localStorage.setItem(LAST_BACKUP_KEY, data.exportedAt);
        }
        renderBackupStatus();

        if (includesAccounts) {
            saveAccounts(data.accounts);
            renderAccounts();
        }
        if (includesBudgets) saveBudgets(data.budgets);

        await render();

        alert("Backup ripristinato: movimenti" +
            (includesAccounts ? ", conti" : "") +
            (includesBudgets ? " e budget." : ". I dati non inclusi nel backup sono rimasti invariati."));

    } catch (error) {

        alert("File di backup non valido.");

    }

    event.target.value = "";

});


// IMPORTAZIONE XLSX (lettura ZIP/XML nativa, senza dipendenze esterne)
async function unzipXlsx(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) { if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error("Archivio XLSX non valido.");
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const files = {};
    for (let n = 0; n < count; n++) {
        if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Indice XLSX non valido.");
        const method = view.getUint16(offset + 10, true), compressed = view.getUint32(offset + 20, true);
        const nameLen = view.getUint16(offset + 28, true), extraLen = view.getUint16(offset + 30, true), commentLen = view.getUint16(offset + 32, true);
        const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLen));
        const local = view.getUint32(offset + 42, true), localName = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
        const start = local + 30 + localName + localExtra;
        const chunk = bytes.slice(start, start + compressed);
        let raw;
        if (method === 0) raw = chunk;
        else if (method === 8) {
            if (!window.DecompressionStream) throw new Error("Questo Safari non supporta la lettura XLSX integrata. Esporta il foglio in CSV e riprova.");
            const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
            raw = new Uint8Array(await new Response(stream).arrayBuffer());
        } else { offset += 46 + nameLen + extraLen + commentLen; continue; }
        files[name] = new TextDecoder("utf-8").decode(raw);
        offset += 46 + nameLen + extraLen + commentLen;
    }
    return files;
}
function xmlDoc(text) { return new DOMParser().parseFromString(text, "application/xml"); }
function colIndex(ref) { return [...ref.match(/[A-Z]+/)[0]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1; }
function excelDate(serial) { const d = new Date(Date.UTC(1899,11,30) + Number(serial)*86400000); return d.toISOString().slice(0,10); }
async function readXlsxRows(file) {
    const z = await unzipXlsx(file);
    const wb = xmlDoc(z["xl/workbook.xml"]);
    const sheet = wb.getElementsByTagName("sheet")[0];
    if (!sheet) throw new Error("Nessun foglio trovato nel file.");
    const rels = xmlDoc(z["xl/_rels/workbook.xml.rels"]);
    const rid = sheet.getAttribute("r:id");
    const rel = [...rels.getElementsByTagName("Relationship")].find(x=>x.getAttribute("Id")===rid);
    if (!rel) throw new Error("Impossibile individuare il foglio dati.");
    let target = rel.getAttribute("Target").replace(/^\//, "");
    if (!target.startsWith("xl/")) target = "xl/" + target;
    const shared = z["xl/sharedStrings.xml"] ? [...xmlDoc(z["xl/sharedStrings.xml"]).getElementsByTagName("si")].map(si=>[...si.getElementsByTagName("t")].map(t=>t.textContent).join("")) : [];
    const doc = xmlDoc(z[target]);
    const rows = [...doc.getElementsByTagName("row")].map(row=>{
        const obj={};
        [...row.getElementsByTagName("c")].forEach(c=>{
            const idx=colIndex(c.getAttribute("r")); const v=c.getElementsByTagName("v")[0];
            let value=v?v.textContent:""; const type=c.getAttribute("t");
            if(type==="s") value=shared[Number(value)]||"";
            else if(type==="inlineStr") value=[...c.getElementsByTagName("t")].map(t=>t.textContent).join("");
            else if(type==="b") value=value==="1";
            obj[idx]=value;
        }); return obj;
    });
    return rows;
}
function parseImportAmount(value) { if(value===null||value===undefined||value==="") return null; const n=Number(String(value).replace(/\s/g,"").replace(",",".")); return Number.isFinite(n)?Math.round(Math.abs(n)*100)/100:null; }
function importMapping(method, category, amount) {
    const m=String(method||"").trim().toLocaleLowerCase("it");
    if(m==="ticket restaurant") return {type:"income", accountId:"conto-buoni-pasto", category:"Buoni pasto", payment:"Ticket Restaurant"};
    if(m==="revolut"||m==="fidaty oro") return {type: amount < 0 ? "expense":"income", accountId:"conto-revolut", category:category||"Altro", payment:String(method).trim()};
    return {type: amount < 0 ? "expense":"income", accountId:"conto-principale", category:category||"Altro", payment:String(method||"Altro").trim()};
}
let pendingExcelImport = null;
const excelInput = $("excelFile");
if (excelInput) excelInput.addEventListener("change", async event=>{
    const file=event.target.files[0]; if(!file) return;
    const preview=$("excelPreview"); preview.textContent="Lettura del file Excel...";
    try {
        const rows=await readXlsxRows(file);
        const headers=rows.find(r=>String(r[0]||"").trim()==="Data") || rows.find(r=>Object.values(r).some(v=>String(v).trim()==="Data"));
        if(!headers) throw new Error("Non trovo la riga delle intestazioni (Data, Movimento, Descrizione...).");
        const headerRow=rows.indexOf(headers);
        const names=Object.keys(headers).reduce((o,k)=>{o[String(headers[k]).trim().toLocaleLowerCase("it")]=Number(k);return o;},{});
        const required=["data","descrizione","check","metodo pagamento","categoria"];
        if(required.some(k=>names[k]===undefined)) throw new Error("Le colonne del file non corrispondono al modello Movi.xlsx.");
        const existing=await allMovements();
        const keys=new Set(existing.map(m=>[m.date,(m.description||"").trim().toLowerCase(),m.amount,m.payment||"",m.category||""].join("|")));
        const candidates=[]; let ignored=0, duplicates=0;
        rows.slice(headerRow+1).forEach(r=>{
            const desc=String(r[names["descrizione"]]||"").trim();
            const rawDate=r[names["data"]];
            const date=(typeof rawDate==="number" || /^\d+(\.\d+)?$/.test(String(rawDate||"")))?excelDate(rawDate):String(rawDate||"").slice(0,10);
            const method=String(r[names["metodo pagamento"]]||"").trim();
            const check=String(r[names["check"]]).toLowerCase()==="true"||r[names["check"]]===true||String(r[names["check"]])==="1";
            const verified=names["importo verificato"]!==undefined?parseImportAmount(r[names["importo verificato"]]):null;
            const movement=names["movimento"]!==undefined?parseImportAmount(r[names["movimento"]]):null;
            const amount=verified!==null?verified:movement;
            if(!desc||!date||amount===null){ignored++;return;}
            const rawAmount=Number(r[names["importo verificato"]]||r[names["movimento"]]||0);
            const cat=String(r[names["categoria"]]||"").trim();
            const mapped=importMapping(method,cat,rawAmount);
            const item={date,type:mapped.type,amount,description:desc,category:mapped.category,payment:mapped.payment,accountId:mapped.accountId,checked:check,notes:"Importato da Movi.xlsx",createdAt:new Date().toISOString()};
            const key=[date,desc.toLowerCase(),amount,item.payment,item.category].join("|");
            if(keys.has(key)){duplicates++;return;} keys.add(key); candidates.push(item);
        });
        pendingExcelImport=candidates;
        preview.innerHTML=`<div class="excel-summary"><strong>Anteprima importazione</strong><p>${candidates.length} movimenti nuovi · ${candidates.filter(x=>x.checked).length} contabilizzati · ${candidates.filter(x=>!x.checked).length} programmati</p><p>${duplicates} duplicati esclusi · ${ignored} righe vuote o incomplete ignorate</p><button type="button" id="confirmExcelImport" class="primary">Importa ${candidates.length} movimenti</button> <button type="button" id="cancelExcelImport" class="ghost">Annulla</button></div>`;
        $("confirmExcelImport").addEventListener("click",async()=>{
            if(!pendingExcelImport?.length){alert("Non ci sono movimenti da importare.");return;}
            if(!confirm(`Confermi l'importazione di ${pendingExcelImport.length} movimenti? I dati esistenti non verranno sostituiti.`))return;
            for(const item of pendingExcelImport) {
                if(item.accountId === "conto-revolut") ensureImportAccount("conto-revolut","Conto corrente Revolut","bank");
                if(item.accountId === "conto-buoni-pasto") ensureImportAccount("conto-buoni-pasto","Conto Buoni Pasto","card");
                await saveMovement(item);
            }
            const n=pendingExcelImport.length; pendingExcelImport=null; preview.textContent=`Importazione completata: ${n} movimenti aggiunti. I movimenti programmati non incidono sui totali.`;
            render(); renderAccounts();
        });
        $("cancelExcelImport").addEventListener("click",()=>{pendingExcelImport=null;preview.textContent="Importazione annullata.";});
    } catch(err){ preview.textContent="Errore: "+err.message; }
    event.target.value="";
});

// CREAZIONE FILE DA SCARICARE

function downloadBlob(content, filename, type) {

    const url = URL.createObjectURL(
        new Blob([content], { type })
    );

    const link = document.createElement("a");

    link.href = url;

    link.download = filename;

    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

}

// AVVIO APPLICAZIONE

async function initializeApp() {

    $("date").value = new Date()
        .toISOString()
        .slice(0, 10);

    updateCategories();
    refreshMovementAccounts("conto-principale");
    if ($("budgetMonth")) $("budgetMonth").value = currentMonth();

    db = await openDB();

    await render();
    if (typeof renderAccounts === "function") await renderAccounts();
    if (typeof renderAccountAnalysis === "function") await renderAccountAnalysis();
    renderBackupStatus();

    // ATTIVAZIONE MODALITA OFFLINE

    if ("serviceWorker" in navigator) {

        navigator.serviceWorker.register("./sw.js")
            .catch(error => {
                console.error(
                    "Service Worker non disponibile:",
                    error
                );
            });

    }

}

initializeApp().catch(error => {

    console.error("Errore inizializzazione:", error);

    alert("Impossibile inizializzare il database.");

});
