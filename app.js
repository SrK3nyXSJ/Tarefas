const SUPABASE_URL = "https://oyxhzpijkmsprwoxmnbz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1tuGBK7gVlfCgQM7anM0nQ_EVzbXZJa";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referências do DOM
const formCategoria = document.getElementById('form-categoria');
const catNomeInput = document.getElementById('cat-nome');

const painelFormTarefa = document.getElementById('painel-form-tarefa');
const formTarefa = document.getElementById('form-tarefa');
const formTarefaTitulo = document.getElementById('form-tarefa-titulo');
const tarefaIdInput = document.getElementById('tarefa-id');
const tarefaTituloInput = document.getElementById('tarefa-titulo');
const tarefaDescricaoInput = document.getElementById('tarefa-descricao');
const tarefaCategoriaSelect = document.getElementById('tarefa-categoria');
const tarefaPrazoInput = document.getElementById('tarefa-prazo');
const tarefaStatusSelect = document.getElementById('tarefa-status');

const btnSalvarTarefa = document.getElementById('btn-salvar-tarefa');
const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');

const filtroCategoria = document.getElementById('filtro-categoria');
const filtroStatus = document.getElementById('filtro-status');
const ordenarTarefasSelect = document.getElementById('ordenar-tarefas');
const listaTarefas = document.getElementById('lista-tarefas');

let categoriasCache = [];
let tarefasCache = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarCategorias();
    carregarTarefas();

    formCategoria.addEventListener('submit', salvarCategoria);
    formTarefa.addEventListener('submit', salvarTarefa);
    btnCancelarEdicao.addEventListener('click', resetarFormularioTarefa);

    filtroCategoria.addEventListener('change', renderizarTarefas);
    filtroStatus.addEventListener('change', renderizarTarefas);
    ordenarTarefasSelect.addEventListener('change', renderizarTarefas);
});

// --- CATEGORIAS ---
async function carregarCategorias() {
    const { data, error } = await supabaseClient
        .from('categorias')
        .select('*')
        .order('nome');

    if (error) return console.error('Erro ao carregar categorias:', error);

    categoriasCache = data;
    preencherSelectsCategoria();
}

function preencherSelectsCategoria() {
    const options = categoriasCache
        .map(cat => `<option value="${cat.id}">${cat.nome}</option>`)
        .join('');
    
    tarefaCategoriaSelect.innerHTML = '<option value="">Selecione uma categoria...</option>' + options;
    filtroCategoria.innerHTML = '<option value="">Todas as Categorias</option>' + options;
}

async function salvarCategoria(e) {
    e.preventDefault();
    const nome = catNomeInput.value.trim();
    if (!nome) return;

    const { error } = await supabaseClient
        .from('categorias')
        .insert([{ nome }]);

    if (error) {
        alert('Erro ao salvar categoria: ' + error.message);
    } else {
        catNomeInput.value = '';
        carregarCategorias();
    }
}

// --- TAREFAS ---
async function carregarTarefas() {
    const { data, error } = await supabaseClient
        .from('tarefas')
        .select('*, categorias(nome)')
        .order('criado_em', { ascending: false });

    if (error) return console.error('Erro ao carregar tarefas:', error);

    tarefasCache = data;
    renderizarTarefas();
}

// Verifica se o prazo da tarefa já passou (considerando apenas datas anteriores a hoje)
function verificarVencida(tarefa) {
    if (!tarefa.prazo || tarefa.status === 'concluida') return false;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Corrige fuso horário ao ler YYYY-MM-DD
    const [ano, mes, dia] = tarefa.prazo.split('-');
    const dataPrazo = new Date(ano, mes - 1, dia);
    
    return dataPrazo < hoje;
}

function renderizarTarefas() {
    const catFiltro = filtroCategoria.value;
    const statusFiltro = filtroStatus.value;
    const criterioOrdem = ordenarTarefasSelect.value;

    // 1. Filtragem
    let tarefasProcessadas = tarefasCache.filter(t => {
        const isVencida = verificarVencida(t);
        const matchesCat = !catFiltro || t.categoria_id == catFiltro;
        
        let matchesStatus = true;
        if (statusFiltro === 'vencida') {
            matchesStatus = isVencida;
        } else if (statusFiltro) {
            matchesStatus = t.status === statusFiltro;
        }

        return matchesCat && matchesStatus;
    });

    // 2. Ordenação
    tarefasProcessadas.sort((a, b) => {
        if (criterioOrdem === 'alfabetica') {
            return a.titulo.localeCompare(b.titulo, 'pt-BR');
        } 
        if (criterioOrdem === 'prazo') {
            if (!a.prazo) return 1;
            if (!b.prazo) return -1;
            return new Date(a.prazo) - new Date(b.prazo);
        }
        if (criterioOrdem === 'status') {
            const peso = { pendente: 1, em_andamento: 2, concluida: 3 };
            return peso[a.status] - peso[b.status];
        }
        // Padrão: mais recentes primeiro
        return new Date(b.criado_em) - new Date(a.criado_em);
    });

    // 3. Renderização dos Cards
    listaTarefas.innerHTML = '';

    if (tarefasProcessadas.length === 0) {
        listaTarefas.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-clipboard-text" style="font-size: 2.5rem; margin-bottom: 10px;"></i>
                <p>Nenhuma tarefa encontrada com os filtros atuais.</p>
            </div>
        `;
        return;
    }

    const labelsStatus = {
        pendente: 'Pendente',
        em_andamento: 'Em Andamento',
        concluida: 'Concluída'
    };

    tarefasProcessadas.forEach(tarefa => {
        const isVencida = verificarVencida(tarefa);
        const classeBorda = isVencida ? 'status-vencida' : `status-${tarefa.status}`;
        
        const nomeCat = tarefa.categorias ? tarefa.categorias.nome : 'Sem Categoria';
        
        let prazoTexto = 'Sem prazo';
        if (tarefa.prazo) {
            const [ano, mes, dia] = tarefa.prazo.split('-');
            prazoTexto = `${dia}/${mes}/${ano}`;
            if (isVencida) prazoTexto += ' (Vencido)';
        }

        const card = document.createElement('article');
        card.className = `tarefa-card ${classeBorda}`;

        // Monta botões principais de acordo com o status atual
        let botoesPrincipais = '';
        if (tarefa.status !== 'concluida') {
            if (tarefa.status === 'pendente') {
                botoesPrincipais += `
                    <button class="btn-status btn-andamento" onclick="alterarStatusRapido(${tarefa.id}, 'em_andamento')">
                        <i class="ph ph-play"></i> Em Andamento
                    </button>
                `;
            }
            botoesPrincipais += `
                <button class="btn-status btn-concluir" onclick="alterarStatusRapido(${tarefa.id}, 'concluida')">
                    <i class="ph ph-check-circle"></i> Concluir
                </button>
            `;
        } else {
            botoesPrincipais = `
                <button class="btn-status btn-secondary" onclick="alterarStatusRapido(${tarefa.id}, 'pendente')">
                    <i class="ph ph-arrow-counter-clockwise"></i> Reabrir Tarefa
                </button>
            `;
        }

        card.innerHTML = `
            <div>
                <div class="card-header">
                    <span class="badge-categoria">
                        <i class="ph ph-folder"></i> ${nomeCat}
                    </span>
                    <div class="acoes-secundarias">
                        <button class="btn-icon" onclick="prepararEdicao(${tarefa.id})" title="Editar Tarefa">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button class="btn-icon delete" onclick="excluirTarefa(${tarefa.id})" title="Excluir Tarefa">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="card-body">
                    <h3 class="card-titulo">${tarefa.titulo}</h3>
                    <p class="card-descricao">${tarefa.descricao || 'Sem descrição adicionada.'}</p>
                </div>
            </div>

            <div>
                <div class="card-meta" style="margin-bottom: 12px;">
                    <span class="meta-item ${isVencida ? 'texto-vencido' : ''}">
                        <i class="ph ph-calendar-blank"></i> ${prazoTexto}
                    </span>
                    <span class="meta-item">
                        <strong>${labelsStatus[tarefa.status]}</strong>
                    </span>
                </div>

                <div class="card-footer-actions">
                    ${botoesPrincipais}
                </div>
            </div>
        `;

        listaTarefas.appendChild(card);
    });
}

async function salvarTarefa(e) {
    e.preventDefault();

    const id = tarefaIdInput.value;
    const payload = {
        titulo: tarefaTituloInput.value.trim(),
        descricao: tarefaDescricaoInput.value.trim(),
        categoria_id: tarefaCategoriaSelect.value || null,
        prazo: tarefaPrazoInput.value || null,
        status: tarefaStatusSelect.value
    };

    let error;

    if (id) {
        ({ error } = await supabaseClient
            .from('tarefas')
            .update(payload)
            .eq('id', id));
    } else {
        ({ error } = await supabaseClient
            .from('tarefas')
            .insert([payload]));
    }

    if (error) {
        alert('Erro ao salvar tarefa: ' + error.message);
    } else {
        resetarFormularioTarefa();
        carregarTarefas();
    }
}

async function alterarStatusRapido(id, novoStatus) {
    const { error } = await supabaseClient
        .from('tarefas')
        .update({ status: novoStatus })
        .eq('id', id);

    if (error) {
        alert('Erro ao atualizar status: ' + error.message);
    } else {
        carregarTarefas();
    }
}

function prepararEdicao(id) {
    const tarefa = tarefasCache.find(t => t.id === id);
    if (!tarefa) return;

    tarefaIdInput.value = tarefa.id;
    tarefaTituloInput.value = tarefa.titulo;
    tarefaDescricaoInput.value = tarefa.descricao || '';
    tarefaCategoriaSelect.value = tarefa.categoria_id || '';
    tarefaPrazoInput.value = tarefa.prazo || '';
    tarefaStatusSelect.value = tarefa.status;

    // Destaca o formulário em modo de edição
    painelFormTarefa.classList.add('modo-edicao');
    formTarefaTitulo.innerHTML = '<i class="ph ph-pencil-line"></i> Editando Tarefa';
    btnSalvarTarefa.textContent = 'Salvar Alterações';
    btnCancelarEdicao.classList.remove('hidden');

    painelFormTarefa.scrollIntoView({ behavior: 'smooth' });
}

function resetarFormularioTarefa() {
    tarefaIdInput.value = '';
    formTarefa.reset();

    painelFormTarefa.classList.remove('modo-edicao');
    formTarefaTitulo.innerHTML = '<i class="ph ph-note-pencil"></i> Nova Tarefa';
    btnSalvarTarefa.textContent = 'Cadastrar Tarefa';
    btnCancelarEdicao.classList.add('hidden');
}

async function excluirTarefa(id) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    const { error } = await supabaseClient
        .from('tarefas')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Erro ao excluir tarefa: ' + error.message);
    } else {
        carregarTarefas();
    }
}