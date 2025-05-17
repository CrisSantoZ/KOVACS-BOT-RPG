// arcadia_sistema.js - Lógica Central e Dados do RPG Arcádia (V5 Final)

const { MongoClient } = require('mongodb');
const { EmbedBuilder } = require('discord.js');

// --- ATRIBUTOS VÁLIDOS ---
const atributosValidos = ["forca", "agilidade", "vitalidade", "manabase", "intelecto", "carisma"];

// --- CONFIGURAÇÃO DO MONGODB (lidas do process.env no index.js) ---
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "arcadiaDB";
const MONGODB_FICHAS_COLLECTION = process.env.MONGODB_FICHAS_COLLECTION || "fichas";

// --- CONSTANTES DE CONFIGURAÇÃO DO SERVIDOR DISCORD ---
const ID_CANAL_BOAS_VINDAS_RPG = process.env.ID_CANAL_BOAS_VINDAS_RPG;
const ID_CANAL_RECRUTAMENTO = process.env.ID_CANAL_RECRUTAMENTO;
const ID_CANAL_ATUALIZACAO_FICHAS = process.env.ID_CANAL_ATUALIZACAO_FICHAS;
const NOME_CARGO_VISITANTE = process.env.NOME_CARGO_VISITANTE || "Visitante de Arcádia";
const NOME_CARGO_AVENTUREIRO = process.env.NOME_CARGO_AVENTUREIRO || "Aventureiro De Arcádia";

// =====================================================================================
// DADOS DO JOGO (RAÇAS, CLASSES, REINOS, FEITIÇOS, ITENS)
// =====================================================================================

const RACAS_ARCADIA = [
    { nome: "Eldari", grupo: "Puros", desc: "Elfos nobres com domínio natural da magia arcana, conhecidos por sua sabedoria ancestral e afinidade com energias etéreas. Tendem a ser excelentes conjuradores.", nomeCargo: "Raça: Eldari" },
    { nome: "Valtheran", grupo: "Puros", desc: "Anões de montanhas profundas, exímios forjadores e guerreiros resistentes. Valorizam a honra, a tradição e a força bruta.", nomeCargo: "Raça: Valtheran" },
    { nome: "Seraphim", grupo: "Puros", desc: "Raça alada de aparência angelical, guardiões antigos de locais sagrados. Possuem uma ligação natural com magias de proteção e cura.", nomeCargo: "Raça: Seraphim" },
    { nome: "Terrano", grupo: "Humanos", desc: "Humanos comuns, adaptáveis e versáteis, capazes de se destacar em diversas vocações, desde o combate até as artes arcanas.", nomeCargo: "Raça: Terrano" },
    { nome: "Vharen", grupo: "Humanos", desc: "Humanos com sangue de antigos magos, sensíveis à magia e com predisposição natural para o estudo das artes arcanas e elementais.", nomeCargo: "Raça: Vharen" },
    { nome: "Drakyn", grupo: "Humanos", desc: "Humanos com linhagem de dragões, resultando em habilidades físicas e arcanas elevadas, além de uma presença imponente.", nomeCargo: "Raça: Drakyn" },
    { nome: "Mei'ra", grupo: "Mistos", desc: "Meio-elfos, dotados de diplomacia natural e uma forte ligação com a natureza e suas energias. Excelentes batedores e curandeiros.", nomeCargo: "Raça: Mei'ra" },
    { nome: "Thornak", grupo: "Mistos", desc: "Meio-orcs, possuidores de grande força física e lealdade tribal, frequentemente caçados ou marginalizados por seu sangue.", nomeCargo: "Raça: Thornak" },
    { nome: "Lunari", grupo: "Mistos", desc: "Descendentes de humanos e Seraphim, com uma afinidade especial pela magia lunar, ilusões e segredos noturnos.", nomeCargo: "Raça: Lunari" },
    { nome: "Sombrio", grupo: "Impuros", desc: "Criaturas deformadas por magia proibida ou corrupção sombria, que vivem nas sombras e manipulam energias profanas.", nomeCargo: "Raça: Sombrio" },
    { nome: "Ravkar", grupo: "Impuros", desc: "Homens-besta caóticos e selvagens, frutos de experimentos mágicos ou maldições antigas, com instintos predatórios.", nomeCargo: "Raça: Ravkar" },
    { nome: "Vazio", grupo: "Impuros", desc: "Entidades sem alma, criados por necromancia avançada ou vindos de planos niilistas, são frios, letais e resistentes à magia convencional.", nomeCargo: "Raça: Vazio" }
];

const CLASSES_ARCADIA = [
    { nome: "Arcanista", desc: "Mestre da magia pura e elemental, focado no dano arcano e controle de área. Tipo Predominante: Mágico (Dano/Controle).", nomeCargo: "Classe: Arcanista" },
    { nome: "Guerreiro Real", desc: "Lutador disciplinado e especialista em combate corpo a corpo, utilizando diversas armas e armaduras pesadas. Tipo Predominante: Físico (Tanque/Dano).", nomeCargo: "Classe: Guerreiro Real" },
    { nome: "Feiticeiro Negro", desc: "Usuário de magias proibidas, como necromancia e maldições, que causam debilitação e dano sombrio. Tipo Predominante: Mágico (Debuff/Dano Sombrio).", nomeCargo: "Classe: Feiticeiro Negro" },
    { nome: "Caçador Sombrio", desc: "Perito em rastrear e emboscar, utilizando armadilhas, arcos e bestas, com foco em dano à distância e furtividade. Tipo Predominante: Físico (Dano à Distância/Furtivo).", nomeCargo: "Classe: Caçador Sombrio" },
    { nome: "Guardião da Luz", desc: "Defensor divino que canaliza poderes sagrados para proteger aliados, curar ferimentos e punir os profanos. Tipo Predominante: Suporte (Cura/Proteção/Dano Sagrado).", nomeCargo: "Classe: Guardião da Luz" },
    { nome: "Mestre das Bestas", desc: "Controla criaturas selvagens e utiliza o poder primal da natureza para lutar ao lado de seus companheiros animais. Tipo Predominante: Misto (Dano/Controle/Suporte com Pet).", nomeCargo: "Classe: Mestre das Bestas" },
    { nome: "Bardo Arcano", desc: "Manipula emoções e a realidade com música e magia, oferecendo suporte, controle e ocasionais explosões de dano. Tipo Predominante: Suporte (Buff/Debuff/Controle).", nomeCargo: "Classe: Bardo Arcano" },
    { nome: "Alquimista", desc: "Cria poções, elixires e bombas com efeitos variados, desde cura e buffs até dano elemental e debuffs potentes. Tipo Predominante: Misto (Suporte/Dano/Utilitário).", nomeCargo: "Classe: Alquimista" },
    { nome: "Clérigo da Ordem", desc: "Focado na cura divina, proteção e remoção de maldições, servindo como pilar de sustentação para o grupo. Tipo Predominante: Suporte (Cura/Proteção).", nomeCargo: "Classe: Clérigo da Ordem" },
    { nome: "Andarilho Rúnico", desc: "Usa runas ancestrais imbuídas em suas armas ou lançadas como projéteis para causar efeitos mágicos diversos. Tipo Predominante: Misto (Dano Mágico/Físico/Buff).", nomeCargo: "Classe: Andarilho Rúnico" },
    { nome: "Espadachim Etéreo", desc: "Combina a agilidade da esgrima com manifestações de energia etérea, criando lâminas de pura magia ou se teleportando. Tipo Predominante: Misto (Dano Físico/Mágico/Mobilidade).", nomeCargo: "Classe: Espadachim Etéreo" },
    { nome: "Invasor Dracônico", desc: "Guerreiro que canaliza o poder ancestral dos dragões, usando sopros elementais, garras e uma resistência formidável. Tipo Predominante: Misto (Dano Físico/Mágico/Tanque).", nomeCargo: "Classe: Invasor Dracônico" },
    { nome: "Lâmina da Névoa", desc: "Assassino furtivo que utiliza sombras e ilusões para se aproximar de seus alvos e eliminá-los com precisão letal. Tipo Predominante: Físico (Dano Furtivo/Controle).", nomeCargo: "Classe: Lâmina da Névoa" },
    { nome: "Conjurador do Vazio", desc: "Manipula energias interdimensionais e a essência do Vazio para invocar criaturas profanas e lançar magias devastadoras. Tipo Predominante: Mágico (Dano Sombrio/Invocação/Controle).", nomeCargo: "Classe: Conjurador do Vazio" }
];

const REINOS_ARCADIA = [
    { nome: "Valdoria", desc: "Reino central dos humanos, conhecido por sua diplomacia, comércio e exércitos bem treinados. Valoriza a ordem e a justiça.", nomeCargo: "Reino: Valdoria" },
    { nome: "Elarion", desc: "Antiga e mística floresta élfica, guardiã de segredos ancestrais e magia da natureza. Os Eldari e Mei'ra frequentemente chamam este lugar de lar.", nomeCargo: "Reino: Elarion" },
    { nome: "Durnholde", desc: "Reino anão escavado nas profundezas das montanhas, famoso por suas minas ricas, metalurgia incomparável e resistência inabalável.", nomeCargo: "Reino: Durnholde" },
    { nome: "Caelum", desc: "Cidade flutuante dos Seraphim, um bastião de luz e conhecimento arcano, raramente visitado por outras raças.", nomeCargo: "Reino: Caelum" },
    { nome: "Ravengard", desc: "Domínio desolado e sombrio onde os Sombrios e outras criaturas da noite encontram refúgio. Um lugar de perigo constante e magia profana.", nomeCargo: "Reino: Ravengard" },
    { nome: "Thornmere", desc: "Vasto território livre, composto por planícies, pântanos e pequenas vilas. É uma terra de fronteira, habitada por diversas raças e facções.", nomeCargo: "Reino: Thornmere" },
    { nome: "Isle of Morwyn", desc: "Ilha envolta em névoas e magia proibida, lar de segredos arcanos perigosos e relíquias de poder imenso. Poucos ousam se aventurar por suas costas.", nomeCargo: "Reino: Isle of Morwyn" }
];

// Mapas para fácil acesso aos nomes dos cargos
const MAPA_CARGOS_RACAS = Object.fromEntries(RACAS_ARCADIA.map(r => [r.nome, r.nomeCargo]));
const MAPA_CARGOS_CLASSES = Object.fromEntries(CLASSES_ARCADIA.map(c => [c.nome, c.nomeCargo]));
const MAPA_CARGOS_REINOS = Object.fromEntries(REINOS_ARCADIA.map(re => [re.nome, re.nomeCargo]));

const ITENS_BASE_ARCADIA = {
    // Moedas
    "florin de ouro": { itemNome: "Florin de Ouro", tipo: "Moeda", descricao: "A moeda comum de todos os reinos.", usavel: false, equipavel: false },
    "essência de arcádia": { itemNome: "Essência de Arcádia", tipo: "Moeda Rara", descricao: "Usada para artefatos e magias poderosas.", usavel: false, equipavel: false },

    // Consumíveis de Cura (PV)
    "poção de cura menor": { itemNome: "Poção de Cura Menor", tipo: "Consumível", descricao: "Restaura uma pequena quantidade de PV.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 25, mensagemAoUsar: "Você bebe a Poção de Cura Menor e sente um alívio imediato." }, cooldownSegundos: 60 },
    "poção de cura média": { itemNome: "Poção de Cura Média", tipo: "Consumível", descricao: "Restaura uma quantidade moderada de PV.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 75, mensagemAoUsar: "Você bebe a Poção de Cura Média e suas feridas começam a se fechar." }, cooldownSegundos: 90 },
    "poção de cura maior": { itemNome: "Poção de Cura Maior", tipo: "Consumível", descricao: "Restaura uma grande quantidade de PV.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 150, mensagemAoUsar: "Você bebe a Poção de Cura Maior e sente uma onda de vitalidade percorrer seu corpo." }, cooldownSegundos: 120 },
    "elixir potente de vitalidade": { itemNome: "Elixir Potente de Vitalidade", tipo: "Consumível", descricao: "Um elixir raro que restaura quase toda a vitalidade.", usavel: true, efeito: { tipoEfeito: "CURA_HP_PERCENT", valor: 0.80, mensagemAoUsar: "Você consome o Elixir Potente e sente uma recuperação quase completa!" }, cooldownSegundos: 300 }, // Cura 80% do PV Máx

    // Consumíveis de Cura (PM)
    "poção de mana menor": { itemNome: "Poção de Mana Menor", tipo: "Consumível", descricao: "Restaura uma pequena quantidade de PM.", usavel: true, efeito: { tipoEfeito: "CURA_PM", valor: 20, mensagemAoUsar: "Você bebe a Poção de Mana Menor e sua energia mágica é revigorada." }, cooldownSegundos: 60 },
    "poção de mana média": { itemNome: "Poção de Mana Média", tipo: "Consumível", descricao: "Restaura uma quantidade moderada de PM.", usavel: true, efeito: { tipoEfeito: "CURA_PM", valor: 60, mensagemAoUsar: "Você bebe a Poção de Mana Média e sente sua reserva arcana se recompor." }, cooldownSegundos: 90 },
    "poção de mana maior": { itemNome: "Poção de Mana Maior", tipo: "Consumível", descricao: "Restaura uma grande quantidade de PM.", usavel: true, efeito: { tipoEfeito: "CURA_PM", valor: 120, mensagemAoUsar: "Você bebe a Poção de Mana Maior e sua mente se clareia com poder arcano." }, cooldownSegundos: 120 },
    "elixir potente de energia": { itemNome: "Elixir Potente de Energia", tipo: "Consumível", descricao: "Um elixir raro que restaura quase toda a energia mágica.", usavel: true, efeito: { tipoEfeito: "CURA_PM_PERCENT", valor: 0.80, mensagemAoUsar: "Você consome o Elixir Potente e sente sua mana quase completamente restaurada!" }, cooldownSegundos: 300 }, // Cura 80% do PM Máx

    // Itens Utilitários e de RPG
    "rações de viagem": { itemNome: "Rações de Viagem", tipo: "Consumível", descricao: "Comida para um dia de jornada. Restaura um pouco de vitalidade.", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 10, mensagemAoUsar: "Você consome parte de suas rações e se sente um pouco restaurado." }, cooldownSegundos: 180 },
    "kit de primeiros socorros": { itemNome: "Kit de Primeiros Socorros", tipo: "Consumível", descricao: "Bandagens e ervas medicinais. Restaura um pouco mais de PV que rações e pode remover sangramentos leves (lógica a implementar).", usavel: true, efeito: { tipoEfeito: "CURA_HP", valor: 40, mensagemAoUsar: "Você utiliza o kit de primeiros socorros habilmente." }, cooldownSegundos: 120 },
    "antídoto simples": { itemNome: "Antídoto Simples", tipo: "Consumível", descricao: "Um antídoto básico para venenos fracos (lógica de remoção de condição a implementar).", usavel: true, efeito: { tipoEfeito: "REMOVE_CONDICAO", condicao: "Envenenado_Fraco", mensagemAoUsar: "Você bebe o antídoto e sente o veneno perder a força." }, cooldownSegundos: 90 },
    "bomba de fumaça": { itemNome: "Bomba de Fumaça", tipo: "Consumível", descricao: "Cria uma nuvem de fumaça densa, útil para fugas ou reposicionamento (efeito em combate a implementar).", usavel: true, efeito: { tipoEfeito: "UTILIDADE_COMBATE", efeitoNome: "CortinaDeFumaca", mensagemAoUsar: "Você arremessa a bomba de fumaça, criando uma densa cortina!" }, cooldownSegundos: 180 },
    "pergaminho de teleporte para a cidade": { itemNome: "Pergaminho de Teleporte para a Cidade", tipo: "Consumível", descricao: "Um pergaminho mágico que teleporta o usuário para a capital do reino atual (se aplicável e fora de combate).", usavel: true, efeito: { tipoEfeito: "TELEPORTE", destino: "CapitalDoReino", mensagemAoUsar: "Você lê as palavras do pergaminho e é envolvido por uma luz azulada..." }, cooldownSegundos: 600 }, // Cooldown alto

    // Equipamentos Básicos
    "adaga simples": { itemNome: "Adaga Simples", tipo: "Arma Leve", descricao: "Uma adaga básica de bronze.", usavel: false, equipavel: true, slot: "maoDireita", // Ou maoEsquerda
        efeitoEquipamento: { bonusAtributos: { ataqueBase: 1 } } },
    "espada curta": { itemNome: "Espada Curta", tipo: "Arma Média", descricao: "Uma espada curta de ferro, comum entre aventureiros.", usavel: false, equipavel: true, slot: "maoDireita",
        efeitoEquipamento: { bonusAtributos: { ataqueBase: 3, forca: 1 } } },
    "escudo de madeira": { itemNome: "Escudo de Madeira", tipo: "Escudo", descricao: "Um escudo simples feito de madeira reforçada.", usavel: false, equipavel: true, slot: "maoEsquerda",
        efeitoEquipamento: { bonusAtributos: { defesaBase: 2 } } },
    "capuz de couro": { itemNome: "Capuz de Couro", tipo: "Elmo Leve", descricao: "Um capuz de couro simples que oferece pouca proteção.", usavel: false, equipavel: true, slot: "elmo",
        efeitoEquipamento: { bonusAtributos: { defesaBase: 1 } } },
    "túnica de aventureiro": { itemNome: "Túnica de Aventureiro", tipo: "Armadura Leve", descricao: "Uma túnica de tecido resistente, comum para viajantes.", usavel: false, equipavel: true, slot: "armaduraCorpo",
        efeitoEquipamento: { bonusAtributos: { defesaBase: 2, agilidade: 1 } } },

    // Itens de Ofício e Buff Temporário
    "pedra de amolar": { itemNome: "Pedra de Amolar", tipo: "Consumível", descricao: "Afia uma arma cortante ou perfurante, concedendo um bônus temporário de ataque (efeito a implementar).", usavel: true, efeito: { tipoEfeito: "BUFF_ARMA", atributo: "ataqueBase", valor: 2, duracaoMinutos: 10, mensagemAoUsar: "Você afia sua arma, tornando-a mais letal." }, cooldownSegundos: 300 },
    "foco arcano simples": { itemNome: "Foco Arcano Simples", tipo: "Amuleto", descricao: "Um pequeno cristal que ajuda a canalizar magia. Leve bônus de intelecto.", usavel: false, equipavel: true, slot: "amuleto",
        efeitoEquipamento: { bonusAtributos: { intelecto: 1, manabase: 2 } } },
    "amuleto da vitalidade menor": { itemNome: "Amuleto da Vitalidade Menor", tipo: "Amuleto", descricao: "Um amuleto que aumenta levemente a vitalidade do usuário.", usavel: false, equipavel: true, slot: "amuleto",
        efeitoEquipamento: { bonusAtributos: { vitalidade: 2 } } },
};

const JACKPOT_PREMIOS_NOMES_COMUNS = ["poção de cura menor", "rações de viagem", "florin de ouro"];
const JACKPOT_PREMIOS_NOMES_INCOMUNS = ["poção de mana menor", "poção de cura média", "pedra de amolar"];
const JACKPOT_PREMIOS_NOMES_RAROS = ["adaga simples", "essência de arcádia", "poção de cura maior"];

const FEITICOS_BASE_ARCADIA = {
    // --- FEITIÇOS DE RAÇA ---
    // Eldari
    "eldari_rajada_eterea": {
        id: "eldari_rajada_eterea", nome: "Rajada Etérea Eldari", origemTipo: "raca", origemNome: "Eldari", tipo: "ataque",
        descricao: "Canaliza energia arcana em um feixe instável que busca o ponto fraco do alvo.", cooldownSegundos: 10,
        niveis: [
            { nivel: 1, custoPM: 10, efeitoDesc: "Causa (Intelecto/2) + 8 de dano Arcano.", efeitoDetalhes: { alvo: "único", tipoDano: "Arcano", formulaDano: "(intelecto/2)+8" } },
            { nivel: 2, custoPM: 14, efeitoDesc: "Causa (Intelecto/2) + 12 de dano e reduz 10% da resistência mágica do alvo por 1 turno.", efeitoDetalhes: { alvo: "único", tipoDano: "Arcano", formulaDano: "(intelecto/2)+12", debuff: { atributo: "resistenciaMagica", modificador: "percentual", valor: -0.10, duracaoTurnos: 1 } } }
        ]
    },
    "eldari_escudo_arcano": {
        id: "eldari_escudo_arcano", nome: "Escudo Arcano Eldari", origemTipo: "raca", origemNome: "Eldari", tipo: "defesa",
        descricao: "Cria uma barreira mágica que absorve uma pequena quantidade de dano.", cooldownSegundos: 15,
        niveis: [
            { nivel: 1, custoPM: 8, efeitoDesc: "Concede um escudo que absorve (Intelecto) + 10 de dano por 2 turnos.", efeitoDetalhes: { alvo: "self", tipoBuff: "escudoHP", formulaValor: "intelecto+10", duracaoTurnos: 2 } }
        ]
    },
    // Valtheran
    "valtheran_golpe_poderoso": {
        id: "valtheran_golpe_poderoso", nome: "Golpe Poderoso Valtheran", origemTipo: "raca", origemNome: "Valtheran", tipo: "ataque",
        descricao: "Um ataque físico brutal que pode atordoar oponentes mais fracos.", cooldownSegundos: 12,
        niveis: [
            { nivel: 1, custoPM: 5, efeitoDesc: "Causa (Forca*1.5) de dano Físico. 15% de chance de atordoar por 1 turno.", efeitoDetalhes: { alvo: "único", tipoDano: "Físico", formulaDano: "(forca*1.5)", condicao: { nome: "Atordoado", chance: 0.15, duracaoTurnos: 1} } }
        ]
    },
    "valtheran_pele_de_pedra": {
        id: "valtheran_pele_de_pedra", nome: "Pele de Pedra Valtheran", origemTipo: "raca", origemNome: "Valtheran", tipo: "defesa",
        descricao: "Endurece a pele, aumentando a defesa física por um curto período.", cooldownSegundos: 20,
        niveis: [
            { nivel: 1, custoPM: 7, efeitoDesc: "Aumenta a Defesa Base em (Vitalidade/2) + 5 por 3 turnos.", efeitoDetalhes: { alvo: "self", tipoBuff: "atributo", atributo: "defesaBase", formulaValor: "(vitalidade/2)+5", duracaoTurnos: 3 } }
        ]
    },
    // Seraphim
    "seraphim_raio_celestial": {
        id: "seraphim_raio_celestial", nome: "Raio Celestial Seraphim", origemTipo: "raca", origemNome: "Seraphim", tipo: "ataque",
        descricao: "Invoca um raio de energia sagrada que queima inimigos.", cooldownSegundos: 10,
        niveis: [
            { nivel: 1, custoPM: 12, efeitoDesc: "Causa (Carisma + Intelecto/2) de dano Sagrado.", efeitoDetalhes: { alvo: "único", tipoDano: "Sagrado", formulaDano: "carisma+(intelecto/2)" } }
        ]
    },
    "seraphim_bencao_alada": {
        id: "seraphim_bencao_alada", nome: "Bênção Alada Seraphim", origemTipo: "raca", origemNome: "Seraphim", tipo: "defesa", // Pode ser buff também
        descricao: "Concede a si ou a um aliado uma bênção que aumenta a esquiva e cura levemente.", cooldownSegundos: 18,
        niveis: [
            { nivel: 1, custoPM: 10, efeitoDesc: "Cura (Carisma/2) PV e aumenta a Agilidade em 3 por 2 turnos.", efeitoDetalhes: { alvo: "aliado", tipoCura: "PV", formulaCura: "carisma/2", buff: { atributo: "agilidade", modificador: "fixo", valor: 3, duracaoTurnos: 2 } } }
        ]
    },
    // ... (Adicionar mais feitiços de raça aqui, seguindo o padrão) ...

    // --- FEITIÇOS DE CLASSE ---
    // Arcanista
    "arcanista_explosao_arcana": { // Renomeado de "explosao_arcana" para especificidade
        id: "arcanista_explosao_arcana", nome: "Explosão Arcana", origemTipo: "classe", origemNome: "Arcanista", tipo: "ataque",
        descricao: "Libera uma onda de energia bruta que afeta todos os inimigos próximos.", cooldownSegundos: 20,
        niveis: [
            { nivel: 1, custoPM: 15, efeitoDesc: "Causa (Intelecto) + 5 de dano em área.", efeitoDetalhes: { alvo: "área", raio: 2, tipoDano: "Arcano", formulaDano: "intelecto+5" } }
        ]
    },
    "arcanista_runa_de_protecao": {
        id: "arcanista_runa_de_protecao", nome: "Runa de Proteção Arcana", origemTipo: "classe", origemNome: "Arcanista", tipo: "defesa",
        descricao: "Inscreve uma runa no chão que protege o conjurador contra magia.", cooldownSegundos: 25,
        niveis: [
            { nivel: 1, custoPM: 12, efeitoDesc: "Aumenta a Resistência Mágica em (Intelecto/3) + 10% por 3 turnos.", efeitoDetalhes: { alvo: "self", tipoBuff: "resistenciaMagicaPercent", formulaValor: "(intelecto/3)+10", duracaoTurnos: 3 } } // Valor será percentual
        ]
    },
    // Guerreiro Real
    "guerreiro_grito_de_guerra": {
        id: "guerreiro_grito_de_guerra", nome: "Grito de Guerra Real", origemTipo: "classe", origemNome: "Guerreiro Real", tipo: "ataque", // Pode ser buff/debuff
        descricao: "Um grito intimidador que desmoraliza inimigos próximos e inspira aliados.", cooldownSegundos: 18,
        niveis: [
            { nivel: 1, custoPM: 8, efeitoDesc: "Reduz o Ataque Base de inimigos em área em 5 por 2 turnos. Aumenta o Ataque Base de aliados próximos em 3.", efeitoDetalhes: { alvo: "área", raio: 2, debuffInimigos: { atributo: "ataqueBase", modificador: "fixo", valor: -5, duracaoTurnos: 2 }, buffAliados: { atributo: "ataqueBase", modificador: "fixo", valor: 3, duracaoTurnos: 2 } } }
        ]
    },
    "guerreiro_postura_defensiva": {
        id: "guerreiro_postura_defensiva", nome: "Postura Defensiva Real", origemTipo: "classe", origemNome: "Guerreiro Real", tipo: "defesa",
        descricao: "Adota uma postura inabalável, aumentando drasticamente a defesa mas reduzindo a mobilidade.", cooldownSegundos: 20,
        niveis: [
            { nivel: 1, custoPM: 10, efeitoDesc: "Aumenta a Defesa Base em (Vitalidade) + 10, mas reduz Agilidade em 5 por 3 turnos.", efeitoDetalhes: { alvo: "self", buff: { atributo: "defesaBase", formulaValor: "vitalidade+10", duracaoTurnos: 3 }, debuff: { atributo: "agilidade", modificador: "fixo", valor: -5, duracaoTurnos: 3 } } }
        ]
    },
    // Feiticeiro Negro
    "feiticeiro_toque_vampirico": {
        id: "feiticeiro_toque_vampirico", nome: "Toque Vampírico Negro", origemTipo: "classe", origemNome: "Feiticeiro Negro", tipo: "ataque",
        descricao: "Drena a força vital de um alvo, causando dano sombrio e curando o conjurador.", cooldownSegundos: 15,
        niveis: [
            { nivel: 1, custoPM: 12, efeitoDesc: "Causa (Intelecto*0.8) de dano Sombrio e cura o conjurador em 50% do dano causado.", efeitoDetalhes: { alvo: "único", tipoDano: "Sombra", formulaDano: "(intelecto*0.8)", curaPropriaPercentDano: 0.50 } }
        ]
    },
    "feiticeiro_armadura_de_ossos": {
        id: "feiticeiro_armadura_de_ossos", nome: "Armadura de Ossos Negra", origemTipo: "classe", origemNome: "Feiticeiro Negro", tipo: "defesa",
        descricao: "Conjura uma armadura feita de ossos espectrais que oferece proteção e retalia dano.", cooldownSegundos: 30,
        niveis: [
            { nivel: 1, custoPM: 15, efeitoDesc: "Concede (Vitalidade*2) de PV temporário. Inimigos que atacarem corpo-a-corpo recebem (Intelecto/4) de dano Sombrio. Dura 3 turnos.", efeitoDetalhes: { alvo: "self", tipoBuff: "escudoHP", formulaValor: "(vitalidade*2)", duracaoTurnos: 3, retaliacao: { tipoDano: "Sombra", formulaDano: "(intelecto/4)", gatilho: "ataqueCorpoACorpo" } } }
        ]
    },
    // ... (Adicionar mais feitiços de classe aqui, seguindo o padrão) ...

    // --- FEITIÇOS DE REINO ---
    // Valdoria
    "valdoria_luz_sagrada": { // Renomeado de "luz_sagrada_valdoria" para especificidade
        id: "valdoria_luz_sagrada", nome: "Luz Sagrada de Valdoria", origemTipo: "reino", origemNome: "Valdoria", tipo: "cura",
        descricao: "Invoca a energia curativa das antigas igrejas de Valdoria.", cooldownSegundos: 15,
        niveis: [
            { nivel: 1, custoPM: 12, efeitoDesc: "Cura (Carisma * 2) + (Intelecto/2) PV.", efeitoDetalhes: { alvo: "aliado", tipoCura: "PV", formulaCura: "(carisma*2)+(intelecto/2)" } }
        ]
    },
    // Elarion
    "elarion_bencao_da_floresta": {
        id: "elarion_bencao_da_floresta", nome: "Bênção da Floresta de Elarion", origemTipo: "reino", origemNome: "Elarion", tipo: "cura",
        descricao: "Canaliza a energia vital da floresta para curar gradualmente um aliado.", cooldownSegundos: 20,
        niveis: [
            { nivel: 1, custoPM: 10, efeitoDesc: "Cura (Intelecto/2 + Carisma/2) PV por turno durante 3 turnos.", efeitoDetalhes: { alvo: "aliado", tipoCura: "PV_HOT", formulaCuraPorTurno: "(intelecto/2)+(carisma/2)", duracaoTurnos: 3 } } // HoT = Heal over Time
        ]
    },
    // Durnholde
    "durnholde_toque_restaurador_anao": {
        id: "durnholde_toque_restaurador_anao", nome: "Toque Restaurador Anão", origemTipo: "reino", origemNome: "Durnholde", tipo: "cura",
        descricao: "Um toque que imbui resiliência anã, curando e removendo um debuff menor.", cooldownSegundos: 18,
        niveis: [
            { nivel: 1, custoPM: 14, efeitoDesc: "Cura (Vitalidade * 1.5) PV e remove um efeito negativo de atributo (ex: Força reduzida).", efeitoDetalhes: { alvo: "aliado", tipoCura: "PV", formulaCura: "(vitalidade*1.5)", removeDebuff: { tipo: "atributoMenor" } } }
        ]
    },
    // ... (Adicionar mais feitiços de reino aqui, seguindo o padrão) ...
};


const fichaModeloArcadia = {
    _id: "", // ID do Discord do Jogador
    nomeJogadorSalvo: "", // Nome de usuário do Discord
    nomePersonagem: "N/A",
    raca: "A Ser Definida",
    classe: "A Ser Definida",
    origemReino: "N/A",
    nivel: 1,
    xpAtual: 0,
    xpProximoNivel: 100, // Calculado por calcularXpProximoNivel(nivel)
    atributos: {
        forca: 5,
        agilidade: 5,
        vitalidade: 5,
        manabase: 5, // Usado para calcular PM Max
        intelecto: 5,
        carisma: 5,
        pontosParaDistribuir: 30
    },
    pvMax: 0, // Calculado: (vitalidade * 5) + (nivel * 5) + 20
    pvAtual: 0,
    pmMax: 0, // Calculado: (manabase * 5) + (nivel * 3) + 10
    pmAtual: 0,
    ataqueBase: 0,
    defesaBase: 0,
    resistenciaMagica: 0, // Novo atributo base para cálculo
    reputacao: {},
    florinsDeOuro: 50,
    essenciaDeArcadia: 0,
    habilidadesEspeciais: [],
    pericias: [],
    magiasConhecidas: [], // Array de objetos: { id: "id_feitico", nivel: 1 }
    equipamento: {
        maoDireita: null, maoEsquerda: null, armaduraCorpo: null,
        elmo: null, amuleto: null, anel1: null, anel2: null
    },
    cooldownsFeiticos: {}, // { "id_feitico_idJogador": timestamp_proximo_uso }
    inventario: [
        { ...JSON.parse(JSON.stringify(ITENS_BASE_ARCADIA["adaga simples"])), quantidade: 1 },
        { ...JSON.parse(JSON.stringify(ITENS_BASE_ARCADIA["rações de viagem"])), quantidade: 3 }
    ],
    historiaPersonagem: "",
    idiomas: ["Comum Arcádiano"],
    condicoes: [], // Array de objetos: { nome: "Envenenado", duracaoTurnos: 3, efeito: "..." }
    cooldownsItens: {}, // { "nome_item_lowercase_idJogador": timestamp_proximo_uso }
    ultimaAtualizacao: "",
    logMissoes: [],
    notacoesDM: ""
};

// =====================================================================================
// CONEXÃO COM BANCO DE DADOS E CACHE DE FICHAS
// =====================================================================================
let dbClient;
let fichasCollection;
let todasAsFichas = {}; // Cache local das fichas

async function conectarMongoDB() {
    if (dbClient && dbClient.topology && dbClient.topology.isConnected()) {
        console.log("MongoDB já conectado.");
        return;
    }
    if (!MONGODB_URI) {
        console.error("--- ERRO FATAL: MONGODB_URI não definida! Configure-a nos Secrets ou .env ---");
        throw new Error("MONGODB_URI não definida");
    }
    try {
        console.log("Tentando conectar ao MongoDB Atlas...");
        dbClient = new MongoClient(MONGODB_URI);
        await dbClient.connect();
        const db = dbClient.db(MONGODB_DB_NAME);
        fichasCollection = db.collection(MONGODB_FICHAS_COLLECTION);
        console.log("Conectado com sucesso ao MongoDB Atlas e à coleção:", MONGODB_FICHAS_COLLECTION);
    } catch (error) {
        console.error("ERRO CRÍTICO ao conectar ao MongoDB:", error);
        throw error;
    }
}

async function carregarFichasDoDB() {
    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Tentando reconectar ao DB...");
        await conectarMongoDB();
        if (!fichasCollection) {
            console.error("Falha ao reconectar e inicializar coleção. Carregamento de fichas abortado.");
            return;
        }
    }
    console.log("Carregando fichas do DB para cache...");
    try {
        const fichasDoDB = await fichasCollection.find({}).toArray();
        todasAsFichas = {};
        fichasDoDB.forEach(fichaDB => {
            const idJogador = String(fichaDB._id);
            todasAsFichas[idJogador] = {
                ...JSON.parse(JSON.stringify(fichaModeloArcadia)),
                ...fichaDB,
                _id: idJogador,
                atributos: { ...JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)), ...(fichaDB.atributos || {}) },
                inventario: fichaDB.inventario && Array.isArray(fichaDB.inventario) ? fichaDB.inventario : [],
                magiasConhecidas: fichaDB.magiasConhecidas && Array.isArray(fichaDB.magiasConhecidas) ? fichaDB.magiasConhecidas : [],
                cooldownsFeiticos: fichaDB.cooldownsFeiticos || {},
                cooldownsItens: fichaDB.cooldownsItens || {}
            };
        });
        console.log(`${Object.keys(todasAsFichas).length} fichas carregadas para o cache.`);
    } catch (error) {
        console.error("Erro ao carregar fichas do MongoDB para o cache:", error);
    }
}

async function getFichaOuCarregar(idJogadorDiscord) {
    const idNormalizado = String(idJogadorDiscord);
    let ficha = todasAsFichas[idNormalizado];
    if (!ficha && fichasCollection) {
        try {
            console.log(`Ficha para ${idNormalizado} não encontrada no cache. Buscando no DB...`);
            const fichaDB = await fichasCollection.findOne({ _id: idNormalizado });
            if (fichaDB) {
                ficha = {
                    ...JSON.parse(JSON.stringify(fichaModeloArcadia)),
                    ...fichaDB,
                    _id: idNormalizado,
                    atributos: { ...JSON.parse(JSON.stringify(fichaModeloArcadia.atributos)), ...(fichaDB.atributos || {}) },
                    inventario: fichaDB.inventario && Array.isArray(fichaDB.inventario) ? fichaDB.inventario : [],
                    magiasConhecidas: fichaDB.magiasConhecidas && Array.isArray(fichaDB.magiasConhecidas) ? fichaDB.magiasConhecidas : [],
                    cooldownsFeiticos: fichaDB.cooldownsFeiticos || {},
                    cooldownsItens: fichaDB.cooldownsItens || {}
                };
                todasAsFichas[idNormalizado] = ficha;
                console.log(`Ficha para ${idNormalizado} carregada do DB e adicionada ao cache.`);
            } else {
                console.log(`Nenhuma ficha encontrada no DB para ${idNormalizado}.`);
                return null;
            }
        } catch (dbError) {
            console.error(`Erro ao buscar ficha ${idNormalizado} no DB:`, dbError);
            return null;
        }
    }

    if (ficha) {
        if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
        if (typeof ficha.nivel !== 'number' || ficha.nivel < 1) ficha.nivel = 1;
        ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
        ficha.pmMax = (ficha.atributos.manabase * 5) + (ficha.nivel * 3) + 10;
        if (typeof ficha.pvAtual !== 'number' || ficha.pvAtual > ficha.pvMax || ficha.pvAtual < 0) ficha.pvAtual = ficha.pvMax;
        if (typeof ficha.pmAtual !== 'number' || ficha.pmAtual > ficha.pmMax || ficha.pmAtual < 0) ficha.pmAtual = ficha.pmMax;
        if (typeof ficha.xpProximoNivel !== 'number') ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }
    return ficha;
}

async function salvarFichaNoDB(idJogadorDiscord, fichaData) {
    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Não foi possível salvar a ficha:", idJogadorDiscord);
        return;
    }
    const idNormalizado = String(idJogadorDiscord);
    try {
        const { _id, ...dadosParaSalvar } = fichaData;
        await fichasCollection.updateOne(
            { _id: idNormalizado },
            { $set: dadosParaSalvar },
            { upsert: true }
        );
    } catch (error) {
        console.error(`Erro ao salvar ficha ${idNormalizado} no MongoDB:`, error);
    }
}

async function atualizarFichaNoCacheEDb(idJogadorDiscord, ficha) {
    const idNormalizado = String(idJogadorDiscord);
    ficha.ultimaAtualizacao = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    if (typeof ficha.nivel !== 'number' || ficha.nivel < 1) ficha.nivel = 1;
    ficha.pvMax = (ficha.atributos.vitalidade * 5) + (ficha.nivel * 5) + 20;
    ficha.pmMax = (ficha.atributos.manabase * 5) + (ficha.nivel * 3) + 10;

    if (ficha.pvAtual > ficha.pvMax) ficha.pvAtual = ficha.pvMax;
    if (ficha.pmAtual > ficha.pmMax) ficha.pmAtual = ficha.pmMax;
    if (ficha.pvAtual < 0) ficha.pvAtual = 0;
    if (ficha.pmAtual < 0) ficha.pmAtual = 0;

    if (typeof ficha.xpProximoNivel !== 'number') ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);

    todasAsFichas[idNormalizado] = ficha;
    await salvarFichaNoDB(idNormalizado, ficha);
}

function calcularXpProximoNivel(nivelAtual) {
    return (nivelAtual * 100) + 50;
}

// =====================================================================================
// FUNÇÕES DE LÓGICA DE COMANDOS
// =====================================================================================

function gerarEmbedErro(titulo, descricao) {
    return new EmbedBuilder().setColor(0xFF0000).setTitle(`❌ ${titulo}`).setDescription(descricao);
}

function gerarEmbedSucesso(titulo, descricao) {
    return new EmbedBuilder().setColor(0x00FF00).setTitle(`✅ ${titulo}`).setDescription(descricao);
}

function gerarEmbedAviso(titulo, descricao) {
    return new EmbedBuilder().setColor(0xFFCC00).setTitle(`⚠️ ${titulo}`).setDescription(descricao);
}

function gerarMensagemBoasVindas(nomeUsuarioDiscord) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🌟 Saudações, ${nomeUsuarioDiscord}! Bem-vindo(a) a Arcádia! 🌟`)
        .setDescription("Um mundo medieval vibrante com magia, mas também repleto de perigos...\n\nUse `/comandos` para ver a lista de ações disponíveis.\nUse `/criar` para iniciar sua jornada!")
        .setFooter({text: "Que seus dados rolem a seu favor!"});
}

function gerarEmbedHistoria() {
    return new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle("📜 ARCÁDIA — A ERA DOS REINOS 📜")
        .setDescription('*"Quando os deuses dormem... os mortos despertam."*')
        .addFields(
            { name: "Um Equilíbrio Desfeito", value: "O mundo de Arcádia já conheceu eras de ouro, onde os reinos coexistiam em equilíbrio instável, entre florestas encantadas, cidades flutuantes e fortalezas forjadas sob montanhas. Mas toda paz é uma pausa... e a escuridão sempre encontra seu caminho de volta." },
            { name: "O Despertar Sombrio", value: "Há trinta ciclos lunares, uma presença antiga rompeu os véus entre vida e morte. Sebastian Azakin, o Deus Necromante, despertou dos abismos esquecidos do mundo. Sua alma, banida pelos próprios deuses, retornou com poder sombrio suficiente para dobrar os reinos mais orgulhosos. Com um exército de vazios e mortos silenciosos, ele não quer governar — ele quer reescrever o destino." },
            { name: "A Sombra se Espalha", value: "Sob sua sombra, as fronteiras ruíram. Ravengard se ergueu em guerra, a Ilha de Morwyn sussurrou segredos antes proibidos, e os Sombrios marcharam novamente. Em Valdoria, reis hesitam. Em Elarion, as árvores choram. Em Caelum, nem os Seraphim ousam pronunciar seu nome." },
            { name: "O Chamado", value: "Mas o mundo não pertence apenas aos deuses.\n\nAgora, aventureiros de todas as raças — puros, humanos, mistos e até impuros — despertam para um chamado inevitável. Você pode ser um herói, um traidor, um explorador ou um monstro. Escolha sua raça, seu reino, sua classe... e descubra quem você será nesta nova era de trevas e possibilidades." }
        )
        .setFooter({ text: "Pois em Arcádia, até mesmo os mortos têm histórias para contar..." });
}

function gerarListaRacasEmbed() {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("📜 Raças de Arcádia 📜")
        .setDescription("Escolha uma raça para seu personagem. Use o nome exato no comando `/criar`.");
    RACAS_ARCADIA.forEach(raca => {
        embed.addFields({ name: `${raca.nome} (${raca.grupo})`, value: `*${raca.desc}*`, inline: false });
    });
    return embed;
}

function gerarListaClassesEmbed() {
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("⚔️ Classes de Arcádia ⚔️")
        .setDescription("Escolha uma classe. Use o nome exato no comando `/criar`.");
    CLASSES_ARCADIA.forEach(classe => {
        embed.addFields({ name: classe.nome, value: `*${classe.desc}*`, inline: true });
    });
    return embed;
}

function gerarListaReinosEmbed() {
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle("🏰 Reinos de Arcádia 🏰")
        .setDescription("Escolha um reino de origem. Use o nome exato no comando `/criar`.");
    REINOS_ARCADIA.forEach(reino => {
        embed.addFields({ name: reino.nome, value: `*${reino.desc}*`, inline: false });
    });
    return embed;
}

async function processarCriarFichaSlash(idJogadorDiscord, nomeJogadorDiscord, nomePersonagem, racaNomeInput, classeNomeInput, reinoNomeInput) {
    const fichaExistente = await getFichaOuCarregar(idJogadorDiscord);
    if (fichaExistente && fichaExistente.nomePersonagem !== "N/A") {
        return gerarEmbedAviso("Personagem Já Existente", `Você já tem: **${fichaExistente.nomePersonagem}**. Use \`/ficha\` para vê-lo.`);
    }

    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaNomeInput.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeNomeInput.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === reinoNomeInput.toLowerCase());

    let errorMessages = [];
    if (!nomePersonagem || nomePersonagem.length < 3 || nomePersonagem.length > 25) {
        errorMessages.push("Nome do personagem deve ter entre 3 e 25 caracteres.");
    }
    if (!racaValida) { errorMessages.push(`Raça "${racaNomeInput}" inválida. Use \`/listaracas\`.`); }
    if (!classeValida) { errorMessages.push(`Classe "${classeNomeInput}" inválida. Use \`/listaclasses\`.`); }
    if (!reinoValido) { errorMessages.push(`Reino "${reinoNomeInput}" inválido. Use \`/listareinos\`.`); }

    if (errorMessages.length > 0) {
        return gerarEmbedErro("Erro na Criação", errorMessages.join("\n"));
    }

    let novaFicha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    novaFicha._id = String(idJogadorDiscord);
    novaFicha.nomeJogadorSalvo = nomeJogadorDiscord;
    novaFicha.nomePersonagem = nomePersonagem;
    novaFicha.raca = racaValida.nome;
    novaFicha.classe = classeValida.nome;
    novaFicha.origemReino = reinoValido.nome;

    await atualizarFichaNoCacheEDb(idJogadorDiscord, novaFicha);

    return gerarEmbedSucesso("🎉 Personagem Criado! 🎉",
        `**${nomePersonagem}** (${novaFicha.raca} ${novaFicha.classe} de ${novaFicha.origemReino}) foi criado para ${nomeJogadorDiscord}!\n\nUse \`/distribuirpontos\` para gastar seus 30 pontos iniciais e depois \`/ficha\` para ver seu personagem.`
    ).setTimestamp();
}

async function processarVerFichaEmbed(idAlvoDiscord, isAdminConsultandoOutro, idInvocadorOriginal, nomeInvocadorOriginal) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    const nomeAlvoDisplay = (ficha && ficha.nomeJogadorSalvo) ? ficha.nomeJogadorSalvo : `ID: ${idAlvoDiscord}`;

    if (!ficha || ficha.nomePersonagem === "N/A") {
        let desc = "Ficha não encontrada.";
        if (idAlvoDiscord === idInvocadorOriginal) {
            desc = "Sua ficha não foi encontrada. Use `/criar` para começar sua aventura!";
        } else if (isAdminConsultandoOutro) {
            desc = `Ficha para ${nomeAlvoDisplay} não encontrada.`;
        }
        return gerarEmbedErro("Ficha não Encontrada", desc);
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`🌟 Ficha de: ${ficha.nomePersonagem} 🌟`)
        .setDescription(`*${ficha.raca} ${ficha.classe} de ${ficha.origemReino}*`)
        .addFields(
            { name: 'Jogador Discord', value: ficha.nomeJogadorSalvo || 'N/A', inline: true },
            { name: 'Nível', value: `${ficha.nivel} (XP: ${ficha.xpAtual}/${ficha.xpProximoNivel})`, inline: true },
            { name: '\u200B', value: '\u200B' },
            { name: '❤️ PV (Vida)', value: `${ficha.pvAtual} / ${ficha.pvMax}`, inline: true },
            { name: '💧 PM (Mana)', value: `${ficha.pmAtual} / ${ficha.pmMax}`, inline: true },
            { name: '\u200B', value: '\u200B' },
            { name: '💰 Moedas', value: `${ficha.florinsDeOuro} FO | ${ficha.essenciaDeArcadia} EA`, inline: false }
        );

    let atributosStr = "";
    for (const [attr, valor] of Object.entries(ficha.atributos)) {
        if (attr !== "pontosParaDistribuir") {
            atributosStr += `**${attr.charAt(0).toUpperCase() + attr.slice(1).replace('base', ' Base')}**: ${valor}\n`;
        }
    }
    const pontosParaDistribuir = ficha.atributos.pontosParaDistribuir || 0;
    if (pontosParaDistribuir > 0) {
        const msgPontos = (idAlvoDiscord === idInvocadorOriginal) ? "Você tem" : `${ficha.nomePersonagem} tem`;
        atributosStr += `✨ ${msgPontos} **${pontosParaDistribuir}** pontos para distribuir${(idAlvoDiscord === idInvocadorOriginal) ? " (Use `/distribuirpontos`)" : "."}\n`;
    }
    embed.addFields({ name: '🧠 Atributos', value: atributosStr || 'N/A', inline: false });

    let inventarioStr = "Vazio";
    if (ficha.inventario && ficha.inventario.length > 0) {
        const itensValidos = ficha.inventario.filter(i => i && i.itemNome);
        if (itensValidos.length > 0) {
            inventarioStr = itensValidos.slice(0, 10).map(i => `• ${i.itemNome} (x${i.quantidade || 0})`).join('\n');
            if (itensValidos.length > 10) inventarioStr += `\n*...e mais ${itensValidos.length - 10} item(s).*`;
        }
    }
    embed.addFields({ name: '🎒 Inventário (Max 10 listados)', value: inventarioStr, inline: true });

    let equipamentoStr = "Nenhum item equipado";
    if (ficha.equipamento) {
        let tempEqStr = "";
        for (const slot in ficha.equipamento) {
            if (ficha.equipamento[slot]) {
                const nomeSlotFormatado = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const nomeItemEquipado = (typeof ficha.equipamento[slot] === 'object' && ficha.equipamento[slot].itemNome) ? ficha.equipamento[slot].itemNome : String(ficha.equipamento[slot]);
                tempEqStr += `**${nomeSlotFormatado}**: ${nomeItemEquipado}\n`;
            }
        }
        if (tempEqStr) equipamentoStr = tempEqStr;
    }
    embed.addFields({ name: '⚙️ Equipamento', value: equipamentoStr, inline: true });

    let magiasStr = "Nenhum feitiço conhecido.";
    if (ficha.magiasConhecidas && ficha.magiasConhecidas.length > 0) {
        magiasStr = ficha.magiasConhecidas.map(magia => {
            const feiticoBase = FEITICOS_BASE_ARCADIA[magia.id];
            return feiticoBase ? `• ${feiticoBase.nome} (Nível ${magia.nivel})` : `• Feitiço Desconhecido (ID: ${magia.id})`;
        }).join('\n');
    }
    embed.addFields({ name: '🔮 Feitiços Conhecidos', value: magiasStr, inline: false});
    embed.setFooter({ text: `Consultada por ${nomeInvocadorOriginal} | Arcádia RPG • Atualizada: ${ficha.ultimaAtualizacao || 'N/A'}` });
    return embed;
}

async function processarDistribuirPontosSlash(idJogadorDiscord, atributosOpcoes) {
    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha || ficha.nomePersonagem === "N/A") {
        return gerarEmbedErro("Erro", "Sua ficha não foi encontrada ou não está completa. Use `/criar`.");
    }

    const pontosDisponiveis = ficha.atributos.pontosParaDistribuir || 0;
    if (pontosDisponiveis <= 0) {
        return gerarEmbedAviso("Sem Pontos", "Você não tem pontos de atributo para distribuir no momento.");
    }

    let totalPontosSolicitados = 0;
    let mudancas = {};
    let errosParse = [];

    for (const atrInput in atributosOpcoes) {
        const atrKey = atrInput.toLowerCase().replace('manabase', 'manaBase');
        if (atributosValidos.includes(atrKey)) {
            const valorInt = atributosOpcoes[atrInput];
            if (valorInt <= 0) {
                errosParse.push(`Valor para '${atrKey}' (${valorInt}) deve ser positivo.`);
            } else {
                mudancas[atrKey] = (mudancas[atrKey] || 0) + valorInt;
                totalPontosSolicitados += valorInt;
            }
        }
    }

    if (errosParse.length > 0) {
        return gerarEmbedErro("Erro na Distribuição", "Valores inválidos:\n- " + errosParse.join("\n- "));
    }
    if (totalPontosSolicitados === 0) {
        return gerarEmbedAviso("Nenhuma Alteração", `Nenhum ponto foi especificado para distribuição. Você tem ${pontosDisponiveis} pontos.`);
    }
    if (totalPontosSolicitados > pontosDisponiveis) {
        return gerarEmbedErro("Pontos Insuficientes", `Você tentou usar ${totalPontosSolicitados} pontos, mas só tem ${pontosDisponiveis} disponíveis.`);
    }

    let feedbackMudancasTexto = [];
    for (const atributo in mudancas) {
        const valorAntigo = ficha.atributos[atributo] || 0;
        ficha.atributos[atributo] = valorAntigo + mudancas[atributo];
        feedbackMudancasTexto.push(`**${atributo.charAt(0).toUpperCase() + atributo.slice(1).replace('base',' Base')}**: ${valorAntigo} + ${mudancas[atributo]} → ${ficha.atributos[atributo]}`);
    }
    ficha.atributos.pontosParaDistribuir -= totalPontosSolicitados;

    await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);

    return gerarEmbedSucesso(`Pontos Distribuídos para ${ficha.nomePersonagem}!`,
        feedbackMudancasTexto.join("\n")
    ).addFields({ name: '✨ Pontos Restantes', value: `**${ficha.atributos.pontosParaDistribuir}**` }).setTimestamp();
}

async function aprenderFeitico(idJogador, idFeitico) {
    const ficha = await getFichaOuCarregar(idJogador);
    if (!ficha || ficha.nomePersonagem === "N/A") {
        return { erro: "Sua ficha não foi encontrada ou não está completa. Use `/criar`." };
    }
    const feiticoBase = FEITICOS_BASE_ARCADIA[idFeitico];
    if (!feiticoBase) {
        return { erro: "Feitiço desconhecido. Verifique o nome." };
    }

    let origemValida = false;
    if (feiticoBase.origemTipo === "raca" && ficha.raca === feiticoBase.origemNome) origemValida = true;
    if (feiticoBase.origemTipo === "classe" && ficha.classe === feiticoBase.origemNome) origemValida = true;
    if (feiticoBase.origemTipo === "reino" && ficha.origemReino === feiticoBase.origemNome) origemValida = true;

    if (!origemValida) {
        return { erro: `Você não cumpre os requisitos de ${feiticoBase.origemTipo} (${feiticoBase.origemNome}) para aprender este feitiço.` };
    }

    if (ficha.magiasConhecidas.some(m => m.id === idFeitico)) {
        return { erro: "Você já conhece este feitiço." };
    }

    ficha.magiasConhecidas.push({ id: idFeitico, nivel: 1 });
    await atualizarFichaNoCacheEDb(idJogador, ficha);
    return { sucesso: `Feitiço **${feiticoBase.nome}** aprendido com sucesso!` };
}

function calcularValorDaFormula(formula, atributosConjurador, atributosAlvo = {}) {
    let expressao = formula.replace(/\s/g, '').toLowerCase();
    const todosAtributos = { ...atributosConjurador, ...atributosAlvo };

    for (const atr in todosAtributos) {
        const regex = new RegExp(atr.toLowerCase().replace('base', ''), 'g'); // Remove 'base' do nome do atributo na regex
        expressao = expressao.replace(regex, String(todosAtributos[atr] || 0));
    }
    // Substitui atributos específicos do modelo, como 'manabase' para 'mana' se a fórmula usar 'mana'
    expressao = expressao.replace(/manabase/g, String(todosAtributos.manabase || 0));


    try {
        if (!/^[0-9.+\-*/()\.]+$/.test(expressao)) {
            console.warn("[Parser Fórmula] Expressão contém caracteres inválidos após substituição:", expressao);
            return 0;
        }
        return Math.floor(new Function(`return ${expressao}`)());
    } catch (e) {
        console.error(`[Parser Fórmula] Erro ao calcular fórmula "${formula}" (expressão resultante: "${expressao}"):`, e);
        return 0;
    }
}

async function usarFeitico(idJogador, idFeitico, idAlvo = null) {
    const fichaConjurador = await getFichaOuCarregar(idJogador);
    if (!fichaConjurador || fichaConjurador.nomePersonagem === "N/A") {
        return { erro: "Sua ficha não foi encontrada ou não está completa." };
    }

    const feiticoBase = FEITICOS_BASE_ARCADIA[idFeitico];
    if (!feiticoBase) return { erro: "Feitiço não encontrado." };

    const magiaAprendida = fichaConjurador.magiasConhecidas.find(m => m.id === idFeitico);
    if (!magiaAprendida) return { erro: "Você não conhece este feitiço." };

    const nivelDoFeiticoNoJogador = magiaAprendida.nivel;
    const detalhesDoNivelFeitico = feiticoBase.niveis.find(n => n.nivel === nivelDoFeiticoNoJogador);
    if (!detalhesDoNivelFeitico) return { erro: "Detalhes para este nível de feitiço não foram encontrados." };

    if (fichaConjurador.pmAtual < detalhesDoNivelFeitico.custoPM) return { erro: `Mana insuficiente. Necessário: ${detalhesDoNivelFeitico.custoPM} PM.` };

    const cooldownKey = `${idFeitico}_${idJogador}`;
    if (fichaConjurador.cooldownsFeiticos && fichaConjurador.cooldownsFeiticos[cooldownKey] > Date.now()) {
        const tempoRestante = Math.ceil((fichaConjurador.cooldownsFeiticos[cooldownKey] - Date.now()) / 1000);
        return { erro: `Feitiço "${feiticoBase.nome}" em recarga. Aguarde ${tempoRestante}s.` };
    }

    fichaConjurador.pmAtual -= detalhesDoNivelFeitico.custoPM;
    const cooldownBaseSegundos = feiticoBase.cooldownSegundos || 0;
    const cooldownNivelSegundos = detalhesDoNivelFeitico.cooldownSegundos;
    const cooldownFinalSegundos = typeof cooldownNivelSegundos === 'number' ? cooldownNivelSegundos : cooldownBaseSegundos;

    if (cooldownFinalSegundos > 0) {
        if (!fichaConjurador.cooldownsFeiticos) fichaConjurador.cooldownsFeiticos = {};
        fichaConjurador.cooldownsFeiticos[cooldownKey] = Date.now() + (cooldownFinalSegundos * 1000);
    }

    let mensagemResultadoEfeito = `**${fichaConjurador.nomePersonagem}** usou **${feiticoBase.nome}** (Nível ${nivelDoFeiticoNoJogador})!\n`;
    let mensagemEfeitoEspecifico = "";
    let fichaAlvo = null;
    const efeitoConfig = detalhesDoNivelFeitico.efeitoDetalhes;

    if (!efeitoConfig || !efeitoConfig.alvo) {
        await atualizarFichaNoCacheEDb(idJogador, fichaConjurador); // Salva gasto de mana mesmo se config errada
        return { erro: "Configuração de efeito ou alvo ausente para este feitiço." };
    }

    if (efeitoConfig.alvo === 'self') {
        fichaAlvo = fichaConjurador;
    } else if (['único', 'aliado', 'inimigo'].includes(efeitoConfig.alvo)) {
        if (!idAlvo) {
            await atualizarFichaNoCacheEDb(idJogador, fichaConjurador);
            return { embed: gerarEmbedAviso("Alvo Necessário", `${mensagemResultadoEfeito}\n⚠️ Este feitiço requer um alvo, mas nenhum foi fornecido.`) };
        }
        fichaAlvo = await getFichaOuCarregar(idAlvo);
        if (!fichaAlvo) {
            await atualizarFichaNoCacheEDb(idJogador, fichaConjurador);
            return { embed: gerarEmbedAviso("Alvo Não Encontrado", `${mensagemResultadoEfeito}\n⚠️ Alvo com ID ${idAlvo} não encontrado. O feitiço não teve efeito.`) };
        }
    }

    if (efeitoConfig.alvo === 'área') {
        mensagemEfeitoEspecifico = `(Efeito em área ativado - lógica de múltiplos alvos a ser implementada).\n`;
        // Lógica de dano em área (exemplo simplificado, aplicar a todos os inimigos em um futuro sistema de combate)
        if (feiticoBase.tipo === "ataque" && efeitoConfig.formulaDano) {
             const danoCalculado = calcularValorDaFormula(efeitoConfig.formulaDano, fichaConjurador.atributos); // Sem atributos de alvo específico para área por enquanto
             mensagemEfeitoEspecifico += `💥 Causou **${danoCalculado}** de dano ${efeitoConfig.tipoDano || 'mágico'} em área!\n`;
        }
    } else if (fichaAlvo) {
        switch (feiticoBase.tipo) {
            case "ataque":
                if (efeitoConfig.formulaDano) {
                    const danoCalculado = calcularValorDaFormula(efeitoConfig.formulaDano, fichaConjurador.atributos, fichaAlvo.atributos);
                    if (danoCalculado > 0) {
                        const pvAntes = fichaAlvo.pvAtual;
                        fichaAlvo.pvAtual = Math.max(0, pvAntes - danoCalculado);
                        mensagemEfeitoEspecifico += `💥 Causou **${danoCalculado}** de dano ${efeitoConfig.tipoDano || 'mágico'} a **${fichaAlvo.nomePersonagem}**! (PV: ${pvAntes} → ${fichaAlvo.pvAtual}/${fichaAlvo.pvMax})\n`;
                        if (efeitoConfig.debuff) {
                            // Adicionar à lista de condições do alvo
                            if (!fichaAlvo.condicoes) fichaAlvo.condicoes = [];
                            fichaAlvo.condicoes.push({ nome: `Debuff: ${feiticoBase.nome}`, atributo: efeitoConfig.debuff.atributo, modificador: efeitoConfig.debuff.modificador, valor: efeitoConfig.debuff.valor, duracaoTurnos: efeitoConfig.debuff.duracaoTurnos, origem: feiticoBase.nome });
                            mensagemEfeitoEspecifico += `✨ Aplicou debuff: ${efeitoConfig.debuff.atributo} afetado por ${efeitoConfig.debuff.duracaoTurnos} turno(s).\n`;
                        }
                        if (efeitoConfig.condicao) {
                             if (Math.random() < (efeitoConfig.condicao.chance || 1)) { // Aplica se chance for 1 ou sortear
                                if (!fichaAlvo.condicoes) fichaAlvo.condicoes = [];
                                fichaAlvo.condicoes.push({ nome: efeitoConfig.condicao.nome, duracaoTurnos: efeitoConfig.condicao.duracaoTurnos, origem: feiticoBase.nome });
                                mensagemEfeitoEspecifico += `✨ Aplicou condição: ${efeitoConfig.condicao.nome} por ${efeitoConfig.condicao.duracaoTurnos} turno(s).\n`;
                            }
                        }
                        if (efeitoConfig.curaPropriaPercentDano) {
                            const curaRealizada = Math.floor(danoCalculado * efeitoConfig.curaPropriaPercentDano);
                            if (curaRealizada > 0) {
                                const pvConjuradorAntes = fichaConjurador.pvAtual;
                                fichaConjurador.pvAtual = Math.min(fichaConjurador.pvMax, pvConjuradorAntes + curaRealizada);
                                mensagemEfeitoEspecifico += `🩸 **${fichaConjurador.nomePersonagem}** drenou **${curaRealizada}** PV de **${fichaAlvo.nomePersonagem}**! (PV: ${pvConjuradorAntes} → ${fichaConjurador.pvAtual}/${fichaConjurador.pvMax})\n`;
                            }
                        }

                    } else {
                        mensagemEfeitoEspecifico += `🛡️ O ataque não causou dano efetivo a **${fichaAlvo.nomePersonagem}**.\n`;
                    }
                } else {
                    mensagemEfeitoEspecifico += `❓ Efeito de ataque não detalhado.\n`;
                }
                break;
            case "cura":
                if (efeitoConfig.formulaCura) {
                    const curaCalculada = calcularValorDaFormula(efeitoConfig.formulaCura, fichaConjurador.atributos, fichaAlvo.atributos);
                    if (curaCalculada > 0) {
                        const pvAntes = fichaAlvo.pvAtual;
                        fichaAlvo.pvAtual = Math.min(fichaAlvo.pvMax, pvAntes + curaCalculada);
                        mensagemEfeitoEspecifico += `💖 Curou **${curaCalculada}** ${efeitoConfig.tipoCura || 'PV'} de **${fichaAlvo.nomePersonagem}**! (PV: ${pvAntes} → ${fichaAlvo.pvAtual}/${fichaAlvo.pvMax})\n`;
                    } else {
                        mensagemEfeitoEspecifico += `🌿 A cura não teve efeito significativo em **${fichaAlvo.nomePersonagem}**.\n`;
                    }
                } else if (efeitoConfig.formulaCuraPorTurno) { // Para HoT
                    // Lógica de aplicar HoT (adicionar à lista de condições/buffs do alvo)
                    if (!fichaAlvo.condicoes) fichaAlvo.condicoes = [];
                     const curaPorTurno = calcularValorDaFormula(efeitoConfig.formulaCuraPorTurno, fichaConjurador.atributos, fichaAlvo.atributos);
                    fichaAlvo.condicoes.push({
                        nome: `Cura Contínua: ${feiticoBase.nome}`,
                        tipo: "CURA_HOT",
                        valorPorTurno: curaPorTurno,
                        duracaoTurnos: efeitoConfig.duracaoTurnos,
                        origem: feiticoBase.nome
                    });
                    mensagemEfeitoEspecifico += `🌿 **${fichaAlvo.nomePersonagem}** recebe uma cura contínua de **${curaPorTurno} PV/turno** por ${efeitoConfig.duracaoTurnos} turnos.\n`;
                } else {
                    mensagemEfeitoEspecifico += `❓ Efeito de cura não detalhado.\n`;
                }
                break;
            case "defesa": // Buffs e escudos
                 if (efeitoConfig.tipoBuff === "escudoHP") {
                    const valorEscudo = calcularValorDaFormula(efeitoConfig.formulaValor, fichaConjurador.atributos, fichaAlvo.atributos);
                    // Adicionar lógica para PV temporário ou escudo
                    mensagemEfeitoEspecifico += `🛡️ **${fichaAlvo.nomePersonagem}** recebe um escudo de **${valorEscudo}** por ${efeitoConfig.duracaoTurnos} turnos.\n`;
                } else if (efeitoConfig.tipoBuff === "atributo" && efeitoConfig.buff) { // Correção aqui: era efeitoConfig.buff.formulaValor e efeitoConfig.buff.valor
                    const valorBuff = calcularValorDaFormula(efeitoConfig.buff.formulaValor || String(efeitoConfig.buff.valor || 0), fichaConjurador.atributos, fichaAlvo.atributos);
                    // Adicionar à lista de condições/buffs
                    mensagemEfeitoEspecifico += `✨ **${fichaAlvo.nomePersonagem}** recebe buff em ${efeitoConfig.buff.atributo} de **${valorBuff}** por ${efeitoConfig.buff.duracaoTurnos} turnos.\n`;
                } else if (efeitoConfig.tipoBuff === "resistenciaMagicaPercent" && efeitoConfig.formulaValor) { // Exemplo para Runa de Proteção
                    const valorBuff = calcularValorDaFormula(efeitoConfig.formulaValor, fichaConjurador.atributos, fichaAlvo.atributos);
                     mensagemEfeitoEspecifico += `✨ **${fichaAlvo.nomePersonagem}** aumenta sua Resistência Mágica em **${valorBuff}%** por ${efeitoConfig.duracaoTurnos} turnos.\n`;
                    // Implementar a lógica de buff de resistência mágica na ficha do alvo
                }
                // Adicionar mais lógicas de defesa/buff aqui
                break;
            default:
                mensagemEfeitoEspecifico += `❓ Tipo de feitiço "${feiticoBase.tipo}" com efeito em alvo único não implementado totalmente.\n`;
                break;
        }
    } else if (!['área'].includes(efeitoConfig.alvo)) {
        mensagemEfeitoEspecifico = `⚠️ Não foi possível determinar o alvo para o efeito do feitiço.\n`;
    }

    await atualizarFichaNoCacheEDb(idJogador, fichaConjurador);
    if (fichaAlvo && idJogador !== idAlvo && !['área'].includes(efeitoConfig.alvo)) {
        await atualizarFichaNoCacheEDb(fichaAlvo._id, fichaAlvo);
    }

    const embedResultado = new EmbedBuilder()
        .setColor(0x8A2BE2)
        .setTitle(`✨ Feitiço Lançado: ${feiticoBase.nome}! ✨`)
        .setDescription(mensagemResultadoEfeito + mensagemEfeitoEspecifico.trim())
        .setFooter({text: `PM restante de ${fichaConjurador.nomePersonagem}: ${fichaConjurador.pmAtual}/${fichaConjurador.pmMax}`});
    return { embed: embedResultado };
}


async function processarUsarItem(idJogadorDiscord, nomeItemInput, quantidadeUsar = 1) {
    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha) return gerarEmbedErro("Uso de Item", "Sua ficha não foi encontrada.");

    const nomeItemNormalizado = nomeItemInput.toLowerCase();
    const itemNoInventario = ficha.inventario.find(i => i.itemNome.toLowerCase() === nomeItemNormalizado);

    if (!itemNoInventario) {
        return gerarEmbedAviso("Item Não Encontrado", `Você não possui o item "${nomeItemInput}" no seu inventário.`);
    }
    if (itemNoInventario.quantidade < quantidadeUsar) {
        return gerarEmbedAviso("Quantidade Insuficiente", `Você tentou usar ${quantidadeUsar} de "${itemNoInventario.itemNome}", mas só tem ${itemNoInventario.quantidade}.`);
    }

    const itemBase = ITENS_BASE_ARCADIA[nomeItemNormalizado]; // Pega a definição base do item
    if (!itemBase || !itemBase.usavel) {
        return gerarEmbedAviso("Item Não Usável", `O item "${itemNoInventario.itemNome}" não pode ser usado desta forma.`);
    }

    const cooldownKey = `${nomeItemNormalizado}_${idJogadorDiscord}`;
    if (itemBase.cooldownSegundos && ficha.cooldownsItens && ficha.cooldownsItens[cooldownKey] > Date.now()) {
        const tempoRestante = Math.ceil((ficha.cooldownsItens[cooldownKey] - Date.now()) / 1000);
        return gerarEmbedAviso("Item em Recarga", `"${itemBase.itemNome}" está em recarga. Aguarde ${tempoRestante}s.`);
    }

    let mensagemEfeito = itemBase.efeito.mensagemAoUsar || `Você usou ${itemBase.itemNome}.`;
    let efeitoAplicado = false;

    // Aplicar efeitos do item
    switch (itemBase.efeito.tipoEfeito) {
        case "CURA_HP":
            const pvAntesHP = ficha.pvAtual;
            ficha.pvAtual = Math.min(ficha.pvMax, ficha.pvAtual + itemBase.efeito.valor);
            mensagemEfeito += `\n❤️ PV restaurado: +${ficha.pvAtual - pvAntesHP} (Total: ${ficha.pvAtual}/${ficha.pvMax})`;
            efeitoAplicado = true;
            break;
        case "CURA_PM":
            const pmAntes = ficha.pmAtual;
            ficha.pmAtual = Math.min(ficha.pmMax, ficha.pmAtual + itemBase.efeito.valor);
            mensagemEfeito += `\n💧 PM restaurado: +${ficha.pmAtual - pmAntes} (Total: ${ficha.pmAtual}/${ficha.pmMax})`;
            efeitoAplicado = true;
            break;
        case "CURA_HP_PERCENT":
            const curaPercentHP = Math.floor(ficha.pvMax * itemBase.efeito.valor);
            const pvAntesPercentHP = ficha.pvAtual;
            ficha.pvAtual = Math.min(ficha.pvMax, ficha.pvAtual + curaPercentHP);
             mensagemEfeito += `\n❤️ PV restaurado: +${ficha.pvAtual - pvAntesPercentHP} (Total: ${ficha.pvAtual}/${ficha.pvMax})`;
            efeitoAplicado = true;
            break;
        case "CURA_PM_PERCENT":
            const curaPercentPM = Math.floor(ficha.pmMax * itemBase.efeito.valor);
            const pmAntesPercent = ficha.pmAtual;
            ficha.pmAtual = Math.min(ficha.pmMax, ficha.pmAtual + curaPercentPM);
            mensagemEfeito += `\n💧 PM restaurado: +${ficha.pmAtual - pmAntesPercent} (Total: ${ficha.pmAtual}/${ficha.pmMax})`;
            efeitoAplicado = true;
            break;
        // Adicionar mais tipos de efeito conforme necessário (REMOVE_CONDICAO, BUFF_ARMA, etc.)
        default:
            mensagemEfeito += "\n(Efeito específico não implementado ou item de utilidade.)";
            // Para itens de utilidade, o efeito pode ser narrativo ou gerenciado externamente.
            efeitoAplicado = true; // Assume que foi usado, mesmo que o efeito seja passivo/narrativo
            break;
    }

    if (efeitoAplicado) {
        itemNoInventario.quantidade -= quantidadeUsar;
        if (itemNoInventario.quantidade <= 0) {
            ficha.inventario = ficha.inventario.filter(i => i.itemNome.toLowerCase() !== nomeItemNormalizado);
        }

        if (itemBase.cooldownSegundos) {
            if (!ficha.cooldownsItens) ficha.cooldownsItens = {};
            ficha.cooldownsItens[cooldownKey] = Date.now() + (itemBase.cooldownSegundos * 1000);
        }
        await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);
        return gerarEmbedSucesso("Item Usado!", mensagemEfeito);
    } else {
        return gerarEmbedAviso("Efeito Não Aplicado", `Não foi possível aplicar o efeito do item "${itemBase.itemNome}".`);
    }
}


async function processarJackpot(idJogadorDiscord, args) {
    const ficha = await getFichaOuCarregar(idJogadorDiscord);
    if (!ficha) { return gerarEmbedErro("Jackpot Arcádia", "Sua ficha não foi encontrada para tentar a sorte."); }

    const custoPorGiro = 25;
    const numGirosInput = args[0] ? parseInt(args[0]) : 1;
    const numGiros = Math.max(1, Math.min(numGirosInput, 10)); // Entre 1 e 10 giros
    const custoTotal = custoPorGiro * numGiros;

    if (ficha.florinsDeOuro < custoTotal) {
        return gerarEmbedAviso("Jackpot Arcádia", `Você não tem ${custoTotal} Florins de Ouro para ${numGiros} giro(s). Você possui ${ficha.florinsDeOuro} FO.`);
    }

    ficha.florinsDeOuro -= custoTotal;
    let resultados = [];
    let premiosTexto = [];
    let ganhouAlgo = false;

    for (let i = 0; i < numGiros; i++) {
        const resultadoGiro = [];
        for (let j = 0; j < 3; j++) { // 3 slots
            const rand = Math.random() * 100;
            if (rand < 5) resultadoGiro.push("💎"); // Raro (5%)
            else if (rand < 25) resultadoGiro.push("🌟"); // Incomum (20%)
            else resultadoGiro.push("⚪"); // Comum (75%)
        }
        resultados.push(resultadoGiro.join(" | "));

        // Verificar prêmios (exemplo simples)
        if (resultadoGiro[0] === "💎" && resultadoGiro[1] === "💎" && resultadoGiro[2] === "💎") {
            const premio = JACKPOT_PREMIOS_NOMES_RAROS[Math.floor(Math.random() * JACKPOT_PREMIOS_NOMES_RAROS.length)];
            premiosTexto.push(`💎💎💎 Jackpot Raro! Você ganhou: **${premio}**!`);
            await adicionarItemAoInventario(ficha, premio, 1);
            ganhouAlgo = true;
        } else if (resultadoGiro.every(s => s === "🌟")) {
            const premio = JACKPOT_PREMIOS_NOMES_INCOMUNS[Math.floor(Math.random() * JACKPOT_PREMIOS_NOMES_INCOMUNS.length)];
            premiosTexto.push(`🌟🌟🌟 Prêmio Incomum! Você ganhou: **${premio}**!`);
            await adicionarItemAoInventario(ficha, premio, 1);
            ganhouAlgo = true;
        } else if (resultadoGiro.filter(s => s === "🌟").length >= 2) {
             const premio = JACKPOT_PREMIOS_NOMES_COMUNS[Math.floor(Math.random() * JACKPOT_PREMIOS_NOMES_COMUNS.length)];
            premiosTexto.push(`🌟🌟 Prêmio Comum! Você ganhou: **${premio}**!`);
            await adicionarItemAoInventario(ficha, premio, 1);
            ganhouAlgo = true;
        }
    }

    await atualizarFichaNoCacheEDb(idJogadorDiscord, ficha);

    const embed = new EmbedBuilder()
        .setColor(ganhouAlgo ? 0xFFD700 : 0x7F8C8D)
        .setTitle("🎰 Jackpot Arcádia 🎰")
        .setDescription(`Você gastou ${custoTotal} FO em ${numGiros} giro(s).\n\n**Resultados:**\n${resultados.join("\n")}`)
        .setFooter({ text: `Saldo atual: ${ficha.florinsDeOuro} FO` });

    if (premiosTexto.length > 0) {
        embed.addFields({ name: "🏆 Prêmios Ganhos:", value: premiosTexto.join("\n") });
    } else {
        embed.addFields({ name: "😕 Resultado:", value: "Que pena! Mais sorte da próxima vez." });
    }
    return embed;
}

async function adicionarItemAoInventario(ficha, nomeItem, quantidade) {
    if (!ficha || !ficha.inventario) return;
    const itemBase = ITENS_BASE_ARCADIA[nomeItem.toLowerCase()];
    if (!itemBase) return; // Não adiciona se não for um item base conhecido

    const itemExistente = ficha.inventario.find(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistente) {
        itemExistente.quantidade = (itemExistente.quantidade || 0) + quantidade;
    } else {
        const novoItem = JSON.parse(JSON.stringify(itemBase));
        novoItem.quantidade = quantidade;
        ficha.inventario.push(novoItem);
    }
}


// --- Funções de Lógica de Comandos de Admin ---
async function processarAdminCriarFicha(client, idAlvoDiscord, nomePersonagem, racaNome, classeNome, reinoNome, adminNome) {
    let nomeJogadorAlvoDisplay = `ID:${idAlvoDiscord}`;
    try {
        const targetUser = await client.users.fetch(idAlvoDiscord);
        if (targetUser) nomeJogadorAlvoDisplay = targetUser.username;
    } catch (fetchError) {
        console.warn(`[AdminCriarFicha] Não foi possível buscar nome para ID ${idAlvoDiscord}: ${fetchError.message}`);
    }

    const racaValida = RACAS_ARCADIA.find(r => r.nome.toLowerCase() === racaNome.toLowerCase());
    const classeValida = CLASSES_ARCADIA.find(c => c.nome.toLowerCase() === classeNome.toLowerCase());
    const reinoValido = REINOS_ARCADIA.find(reino => reino.nome.toLowerCase() === reinoNome.toLowerCase());

    let errorMessages = [];
    if (!nomePersonagem || nomePersonagem.length < 3 || nomePersonagem.length > 32) errorMessages.push("Nome do personagem (3-32 chars).");
    if (!racaValida) errorMessages.push(`Raça "${racaNome}" inválida.`);
    if (!classeValida) errorMessages.push(`Classe "${classeNome}" inválida.`);
    if (!reinoValido) errorMessages.push(`Reino "${reinoNome}" inválido.`);

    if (errorMessages.length > 0) {
        return gerarEmbedErro("Erro ao Criar Ficha (Admin)", errorMessages.join("\n"));
    }

    let ficha = JSON.parse(JSON.stringify(fichaModeloArcadia));
    ficha._id = String(idAlvoDiscord);
    ficha.nomeJogadorSalvo = nomeJogadorAlvoDisplay;
    ficha.nomePersonagem = nomePersonagem;
    ficha.raca = racaValida.nome;
    ficha.classe = classeValida.nome;
    ficha.origemReino = reinoValido.nome;

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return gerarEmbedSucesso("Ficha Criada/Sobrescrita (Admin)",
        `Personagem **${nomePersonagem}** (${ficha.raca} ${ficha.classe} de ${ficha.origemReino}) para ${ficha.nomeJogadorSalvo} foi criado/sobrescrito por ${adminNome}.`
    ).setTimestamp();
}

async function processarAdminAddXP(idAlvoDiscord, valorXP, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return gerarEmbedErro("Erro Admin", `Ficha não encontrada para ID ${idAlvoDiscord}.`);
    if (isNaN(valorXP)) return gerarEmbedErro("Erro Admin", "Valor de XP inválido.");

    const xpAntes = ficha.xpAtual || 0;
    ficha.xpAtual = xpAntes + valorXP;
    let msgsLevelUp = [];
    let subiuNivel = false;

    while (ficha.xpAtual >= ficha.xpProximoNivel && (ficha.xpProximoNivel || 0) > 0) {
        subiuNivel = true;
        ficha.xpAtual -= ficha.xpProximoNivel;
        const nivelAntigo = ficha.nivel || 0;
        ficha.nivel = nivelAntigo + 1;
        ficha.atributos.pontosParaDistribuir = (ficha.atributos.pontosParaDistribuir || 0) + 2;
        msgsLevelUp.push(`🎉 **${ficha.nomePersonagem}** alcançou o Nível ${ficha.nivel}! Ganhou 2 pontos de atributo.`);
        ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    }

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);

    let desc = `XP de **${ficha.nomePersonagem}** (ID: ${idAlvoDiscord}) alterado de ${xpAntes} para ${ficha.xpAtual}/${ficha.xpProximoNivel} por ${adminNome}.`;
    if (subiuNivel) {
        desc = msgsLevelUp.join("\n") + "\n\n" + desc;
    }
    return gerarEmbedSucesso("XP Adicionado (Admin)", desc).setTimestamp();
}

async function processarAdminSetNivel(idAlvoDiscord, novoNivel, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return gerarEmbedErro("Erro Admin", `Ficha não encontrada para ID ${idAlvoDiscord}.`);
    if (isNaN(novoNivel) || novoNivel < 1) return gerarEmbedErro("Erro Admin", "Nível inválido. Deve ser um número maior ou igual a 1.");

    const nivelAntigo = ficha.nivel || 1;
    ficha.nivel = novoNivel;
    ficha.xpAtual = 0;
    ficha.xpProximoNivel = calcularXpProximoNivel(ficha.nivel);
    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const diffNivel = novoNivel - nivelAntigo;
    if (diffNivel !== 0) {
      ficha.atributos.pontosParaDistribuir = Math.max(0, (ficha.atributos.pontosParaDistribuir || 0) + (diffNivel * 2));
    }

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return gerarEmbedSucesso("Nível Definido (Admin)",
        `Nível de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) definido para **${ficha.nivel}** por ${adminNome}.\nXP zerado. Pontos para distribuir: **${ficha.atributos.pontosParaDistribuir || 0}**.`);
}

async function processarAdminAddMoedas(idAlvoDiscord, quantidade, tipoMoeda, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return gerarEmbedErro("Erro Admin", `Ficha não encontrada para o jogador com ID ${idAlvoDiscord}.`);
    if (isNaN(quantidade)) return gerarEmbedErro("Erro Admin", "Quantidade de moeda inválida.");

    const nomeMoedaDisplay = tipoMoeda === 'florinsDeOuro' ? "Florins de Ouro (FO)" : "Essências de Arcádia (EA)";
    const saldoAnterior = ficha[tipoMoeda] || 0;
    ficha[tipoMoeda] = saldoAnterior + quantidade;
    if (ficha[tipoMoeda] < 0) ficha[tipoMoeda] = 0;

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return gerarEmbedSucesso(`${nomeMoedaDisplay} Ajustados (Admin)`,
        `${nomeMoedaDisplay} de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) ${quantidade >= 0 ? 'aumentados' : 'diminuídos'} em **${Math.abs(quantidade)}** por ${adminNome}.\nSaldo Anterior: ${saldoAnterior}\nNovo Saldo: **${ficha[tipoMoeda]}**.`);
}

async function processarAdminAddItem(idAlvoDiscord, nomeItemInput, quantidade = 1, tipoCustom, descricaoCustom, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return gerarEmbedErro("Erro Admin", `Ficha não encontrada para o jogador com ID ${idAlvoDiscord}.`);
    if (!ficha.inventario) ficha.inventario = [];
    if (quantidade < 1) return gerarEmbedErro("Erro Admin", "Quantidade do item deve ser ao menos 1.");

    const itemBaseDef = ITENS_BASE_ARCADIA[nomeItemInput.toLowerCase()];
    let itemFinal;
    let origemItemMsg = "";

    if (itemBaseDef) {
        itemFinal = JSON.parse(JSON.stringify(itemBaseDef));
        itemFinal.quantidade = quantidade;
        if (tipoCustom) itemFinal.tipo = tipoCustom;
        if (descricaoCustom) itemFinal.descricao = descricaoCustom;
        origemItemMsg = "Item da base de dados.";
    } else {
        itemFinal = {
            itemNome: nomeItemInput,
            quantidade: quantidade,
            tipo: tipoCustom || "Item Especial (Admin)",
            descricao: descricaoCustom || "Adicionado por um administrador.",
            usavel: false, // Itens customizados por admin são não usáveis por padrão
            equipavel: false // E não equipáveis por padrão
        };
        origemItemMsg = "Item customizado criado.";
    }

    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === itemFinal.itemNome.toLowerCase());
    if (itemExistenteIndex > -1) {
        ficha.inventario[itemExistenteIndex].quantidade = (ficha.inventario[itemExistenteIndex].quantidade || 0) + itemFinal.quantidade;
        if (tipoCustom) ficha.inventario[itemExistenteIndex].tipo = tipoCustom;
        if (descricaoCustom) ficha.inventario[itemExistenteIndex].descricao = descricaoCustom;
    } else {
        ficha.inventario.push(itemFinal);
    }
    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return gerarEmbedSucesso("Item Adicionado ao Inventário (Admin)",
        `**${itemFinal.itemNome}** (x${quantidade}) adicionado ao inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) por ${adminNome}.\n*${origemItemMsg}*`);
}

async function processarAdminDelItem(idAlvoDiscord, nomeItem, quantidadeRemover = 1, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha || !ficha.inventario) return gerarEmbedErro("Erro Admin", `Ficha ou inventário não encontrado para ID ${idAlvoDiscord}.`);
    if (quantidadeRemover < 1) return gerarEmbedErro("Erro Admin", "Quantidade a remover deve ser ao menos 1.");

    const itemExistenteIndex = ficha.inventario.findIndex(i => i.itemNome.toLowerCase() === nomeItem.toLowerCase());
    if (itemExistenteIndex === -1) return gerarEmbedAviso("Item Não Encontrado (Admin)", `Item "${nomeItem}" não encontrado no inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}**.`);

    const itemOriginal = ficha.inventario[itemExistenteIndex];
    if (itemOriginal.quantidade < quantidadeRemover) {
        return gerarEmbedAviso("Quantidade Insuficiente (Admin)",
            `**${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** não tem ${quantidadeRemover} de "${itemOriginal.itemNome}". Possui ${itemOriginal.quantidade}.`);
    }

    itemOriginal.quantidade -= quantidadeRemover;
    let msgRetorno = "";
    if (itemOriginal.quantidade <= 0) {
        ficha.inventario.splice(itemExistenteIndex, 1);
        msgRetorno = `**${itemOriginal.itemNome}** foi removido completamente do inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** por ${adminNome}.`;
    } else {
        msgRetorno = `${quantidadeRemover}x **${itemOriginal.itemNome}** removido(s). Restam ${itemOriginal.quantidade} no inventário de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}**. (Admin: ${adminNome})`;
    }
    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return gerarEmbedSucesso("Item Removido do Inventário (Admin)", msgRetorno);
}

async function processarAdminSetAtributo(idAlvoDiscord, nomeAtributo, novoValor, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return gerarEmbedErro("Erro Admin", `Ficha não encontrada para ID ${idAlvoDiscord}.`);

    const attrKey = nomeAtributo.toLowerCase();
    if (!atributosValidos.includes(attrKey)) {
        return gerarEmbedErro("Erro Admin", `Atributo "${nomeAtributo}" inválido. Válidos: ${atributosValidos.join(', ')}.`);
    }
    if (isNaN(novoValor) || novoValor < 0) {
        return gerarEmbedErro("Erro Admin", `Valor "${novoValor}" para ${attrKey} inválido. Deve ser um número não negativo.`);
    }

    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const valorAntigo = ficha.atributos[attrKey] || 0;
    ficha.atributos[attrKey] = novoValor;
    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    const nomeAtributoDisplay = attrKey.charAt(0).toUpperCase() + attrKey.slice(1).replace('base', ' Base');
    return gerarEmbedSucesso("Atributo Definido (Admin)",
        `Atributo **${nomeAtributoDisplay}** de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) foi alterado de ${valorAntigo} para **${novoValor}** por ${adminNome}.`);
}

async function processarAdminAddPontosAtributo(idAlvoDiscord, quantidade, adminNome) {
    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha) return gerarEmbedErro("Erro Admin", `Ficha não encontrada para ID ${idAlvoDiscord}.`);
    if (isNaN(quantidade)) return gerarEmbedErro("Erro Admin", "Quantidade de pontos inválida.");

    if (!ficha.atributos) ficha.atributos = JSON.parse(JSON.stringify(fichaModeloArcadia.atributos));
    const pontosAntes = ficha.atributos.pontosParaDistribuir || 0;
    ficha.atributos.pontosParaDistribuir = pontosAntes + quantidade;
    if (ficha.atributos.pontosParaDistribuir < 0) ficha.atributos.pontosParaDistribuir = 0;

    await atualizarFichaNoCacheEDb(idAlvoDiscord, ficha);
    return gerarEmbedSucesso("Pontos de Atributo Ajustados (Admin)",
        `Pontos para distribuir de **${ficha.nomePersonagem || ficha.nomeJogadorSalvo}** (ID: ${idAlvoDiscord}) ajustados em ${quantidade} por ${adminNome}.\nDe ${pontosAntes} para **${ficha.atributos.pontosParaDistribuir}**.`);
}

async function processarAdminExcluirFicha(idAlvoDiscord, confirmacao, adminNome, membroAlvo) {
    if (confirmacao !== "CONFIRMAR EXCLUSAO") {
        return gerarEmbedAviso("Exclusão Não Confirmada",
            "A frase de confirmação para excluir a ficha é inválida ou não foi fornecida corretamente. A ficha **NÃO** foi excluída.\nPara confirmar, na opção `confirmacao` do comando, digite a frase exata (maiúsculas e minúsculas importam): `CONFIRMAR EXCLUSAO`");
    }

    const ficha = await getFichaOuCarregar(idAlvoDiscord);
    if (!ficha || ficha.nomePersonagem === "N/A") {
        return gerarEmbedErro("Erro Admin", `Nenhuma ficha válida encontrada para o ID ${idAlvoDiscord}. Nada foi excluído.`);
    }

    const nomePersonagemExcluido = ficha.nomePersonagem;
    const nomeJogadorExcluido = ficha.nomeJogadorSalvo || `ID: ${idAlvoDiscord}`;

    if (!fichasCollection) {
        console.error("Coleção de fichas não inicializada. Exclusão abortada para jogador:", idAlvoDiscord);
        return gerarEmbedErro("Erro Crítico no DB", "Não foi possível conectar à base de dados para excluir a ficha.");
    }

    try {
        const resultadoDB = await fichasCollection.deleteOne({ _id: String(idAlvoDiscord) });
        if (resultadoDB.deletedCount === 1) {
            delete todasAsFichas[String(idAlvoDiscord)];

            let feedbackCargos = "\n\n🎭 Cargos do personagem foram gerenciados.";
            if (membroAlvo) {
                try {
                    const cargosParaRemoverNomes = [
                        MAPA_CARGOS_RACAS[ficha.raca],
                        MAPA_CARGOS_CLASSES[ficha.classe], // Adicionado
                        MAPA_CARGOS_REINOS[ficha.origemReino], // Adicionado
                        NOME_CARGO_AVENTUREIRO
                    ].filter(Boolean);

                    for (const nomeCargo of cargosParaRemoverNomes) {
                        const cargoObj = membroAlvo.guild.roles.cache.find(role => role.name === nomeCargo);
                        if (cargoObj && membroAlvo.roles.cache.has(cargoObj.id)) {
                            await membroAlvo.roles.remove(cargoObj);
                        }
                    }

                    const cargoVisitanteObj = membroAlvo.guild.roles.cache.find(role => role.name === NOME_CARGO_VISITANTE);
                    if (cargoVisitanteObj && !membroAlvo.roles.cache.has(cargoVisitanteObj.id)) {
                        await membroAlvo.roles.add(cargoVisitanteObj); // Readiciona cargo visitante
                    }
                } catch (roleError) {
                    console.error(`Erro ao gerenciar cargos para ${idAlvoDiscord} após exclusão de ficha:`, roleError);
                    feedbackCargos = "\n\n⚠️ Houve um erro ao tentar gerenciar os cargos do membro.";
                }
            } else {
                feedbackCargos = "\n\n(Membro não encontrado no servidor para ajuste de cargos.)";
            }

            console.log(`[ADMIN] Ficha para ${nomeJogadorExcluido} (Personagem: ${nomePersonagemExcluido}, ID: ${idAlvoDiscord}) excluída por ${adminNome}.`);
            return gerarEmbedSucesso("Ficha Excluída Permanentemente (Admin)",
                `A ficha de **${nomePersonagemExcluido}** (Jogador: ${nomeJogadorExcluido}) foi **EXCLUÍDA PERMANENTEMENTE** do banco de dados por ${adminNome}.${feedbackCargos}`);
        } else {
            console.log(`[ADMIN] Tentativa de excluir ficha para ID ${idAlvoDiscord} por ${adminNome}, mas a ficha não foi encontrada no DB (deletedCount: 0).`);
            return gerarEmbedAviso("Atenção (Admin)",
                `A ficha para ID ${idAlvoDiscord} não foi encontrada no banco de dados para ser excluída (ou já havia sido removida).`);
        }
    } catch (error) {
        console.error(`Erro ao excluir ficha para ${idAlvoDiscord} no MongoDB:`, error);
        return gerarEmbedErro("Erro ao Excluir Ficha (Admin)", "Ocorreu um erro no servidor ao tentar excluir a ficha.");
    }
}


function gerarListaComandos(isOwner) {
    let embed = new EmbedBuilder().setColor(0x4A90E2).setTitle("📜 Comandos de Arcádia (Discord)")
        .setDescription("Use os comandos abaixo para interagir com o mundo de Arcádia!");
    embed.addFields(
        { name: '👋 Boas-vindas', value: "`/arcadia`, `/bemvindo`, `/oi`\n*Mensagem inicial.*", inline: false },
        { name: '🏓 Teste', value: "`/ping`\n*Verifica se o bot está responsivo.*", inline: false },
        { name: '✨ Personagem', value: "`/criar nome:<Nome> raca:<Raça> classe:<Classe> reino:<Reino>`\n*Cria seu personagem.*\n\n`/ficha [@jogador]` (opcional)\n*Exibe sua ficha ou de outro jogador (admin).*\n\n`/distribuirpontos [forca:val] [agilidade:val] ...`\n*Distribui seus pontos de atributo.*", inline: false },
        { name: '⚔️ Combate & Magia', value: "`/aprenderfeitico feitico:<nome>`\n*Aprende um feitiço disponível.*\n\n`/usarfeitico feitico:<nome> [alvo:@jogador]`\n*Usa um feitiço conhecido.*", inline: false },
        { name: '🎒 Itens & Ações', value: "`/usaritem item:<nome> [quantidade:val]`\n*Usa um item.*\n\n`/jackpot [giros:val]` (Custo: 25 FO)\n*Tente sua sorte!*", inline: false },
        { name: '📚 Informativos', value: "`/listaracas`, `/listaclasses`, `/listareinos`, `/historia`", inline: false }
    );
    if (isOwner) {
        let adminCommandsDescription = "";
        adminCommandsDescription += "`/admincriar jogador:<@jogador> nome:<nome> raca:<raça> classe:<classe> reino:<reino>`\n*Cria/sobrescreve uma ficha.*\n\n";
        adminCommandsDescription += "`/adminaddxp jogador:<@jogador> xp:<quantidade>`\n*Adiciona XP.*\n\n";
        adminCommandsDescription += "`/adminsetnivel jogador:<@jogador> nivel:<novo_nivel>`\n*Define o nível.*\n\n";
        adminCommandsDescription += "`/adminaddflorins jogador:<@jogador> quantidade:<valor>`\n*Adiciona/remove Florins.*\n\n";
        adminCommandsDescription += "`/adminaddessencia jogador:<@jogador> quantidade:<valor>`\n*Adiciona/remove Essência.*\n\n";
        adminCommandsDescription += "`/adminadditem jogador:<@jogador> item:<nome> [quantidade:val] [tipo:val] [descricao:val]`\n*Adiciona item.*\n\n";
        adminCommandsDescription += "`/admindelitem jogador:<@jogador> item:<nome> [quantidade:val]`\n*Remove item.*\n\n";
        adminCommandsDescription += "`/adminsetattr jogador:<@jogador> atributo:<atr> valor:<val>`\n*Define um atributo.*\n\n";
        adminCommandsDescription += "`/adminaddpontosattr jogador:<@jogador> quantidade:<val>`\n*Adiciona/remove pontos para distribuir.*\n\n";
        adminCommandsDescription += "`/adminexcluirficha jogador:<@jogador> confirmacao:CONFIRMAR EXCLUSAO`\n*EXCLUI PERMANENTEMENTE uma ficha.*";

        embed.addFields(
            {
                name: '👑 Comandos de Admin (Visível Apenas para Você)',
                value: adminCommandsDescription,
                inline: false
            }
        );
    }
    embed.setFooter({ text: "Use /comandos para ver esta lista."});
    return embed;
}

// --- Novas Funções de Autocomplete ---
async function getMagiasConhecidasParaAutocomplete(jogadorId) {
    const ficha = await getFichaOuCarregar(jogadorId);
    if (!ficha || !ficha.magiasConhecidas || ficha.magiasConhecidas.length === 0) {
        return [];
    }
    return ficha.magiasConhecidas.map(magiaAprendida => {
        const feiticoBase = FEITICOS_BASE_ARCADIA[magiaAprendida.id];
        return feiticoBase ? { name: feiticoBase.nome, value: magiaAprendida.id } : null; // Ajustado para 'name' e 'value'
    }).filter(Boolean);
}

async function getInventarioParaAutocomplete(jogadorId) {
    const ficha = await getFichaOuCarregar(jogadorId);
    if (!ficha || !ficha.inventario || ficha.inventario.length === 0) {
        return [];
    }
    // Agrupa itens e mostra quantidade para facilitar a escolha
    const itensAgrupados = ficha.inventario.reduce((acc, item) => {
        const nomeItem = item.itemNome;
        if (nomeItem) { // Garante que o item tem nome
             acc[nomeItem] = (acc[nomeItem] || 0) + (item.quantidade || 0);
        }
        return acc;
    }, {});

    return Object.entries(itensAgrupados)
        .map(([nome, qtd]) => ({ name: `${nome} (x${qtd})`, value: nome })) // value é o nome exato do item
        .filter(item => item.name && item.value); // Garante que tem nome e valor
}


async function getItensBaseParaAutocomplete() {
    return Object.values(ITENS_BASE_ARCADIA)
        .map(item => ({ name: item.itemNome, value: item.itemNome })) // value é o nome exato
        .filter(item => item.name && item.value);
}

async function getTodosFeiticosBaseParaAutocomplete() {
    return Object.values(FEITICOS_BASE_ARCADIA)
        .map(feitico => ({
            name: `${feitico.nome} (${feitico.origemTipo}: ${feitico.origemNome})`,
            value: feitico.id // value é o ID do feitiço
        }))
        .filter(feitico => feitico.name && feitico.value);
}


// =====================================================================================
// EXPORTS DO MÓDULO
// =====================================================================================
module.exports = {
    // Dados e Constantes
    RACAS_ARCADIA, CLASSES_ARCADIA, REINOS_ARCADIA,
    MAPA_CARGOS_RACAS, MAPA_CARGOS_CLASSES, MAPA_CARGOS_REINOS,
    NOME_CARGO_AVENTUREIRO, NOME_CARGO_VISITANTE,
    ID_CANAL_BOAS_VINDAS_RPG, ID_CANAL_RECRUTAMENTO, ID_CANAL_ATUALIZACAO_FICHAS,
    FEITICOS_BASE_ARCADIA, ITENS_BASE_ARCADIA, fichaModeloArcadia,
    atributosValidos,
    JACKPOT_PREMIOS_NOMES_COMUNS, JACKPOT_PREMIOS_NOMES_INCOMUNS, JACKPOT_PREMIOS_NOMES_RAROS,

    // Funções de Banco de Dados e Cache
    conectarMongoDB, carregarFichasDoDB, getFichaOuCarregar,
    atualizarFichaNoCacheEDb, calcularXpProximoNivel,

    // Funções de Geração de Embeds Genéricas
    gerarEmbedErro, gerarEmbedSucesso, gerarEmbedAviso,

    // Funções de Lógica de Comandos de Jogador
    gerarMensagemBoasVindas, gerarEmbedHistoria,
    gerarListaRacasEmbed, gerarListaClassesEmbed, gerarListaReinosEmbed,
    processarCriarFichaSlash, processarVerFichaEmbed, processarDistribuirPontosSlash,
    aprenderFeitico, usarFeitico,
    processarJackpot, processarUsarItem,
    gerarListaComandos,

    // Funções de Lógica de Comandos de Admin
    processarAdminCriarFicha, processarAdminAddXP, processarAdminSetNivel,
    processarAdminAddMoedas, processarAdminAddItem, processarAdminDelItem,
    processarAdminSetAtributo, processarAdminAddPontosAtributo, processarAdminExcluirFicha,

    // Novas Funções de Autocomplete
    getMagiasConhecidasParaAutocomplete, // Mantida e ajustada
    getInventarioParaAutocomplete,
    getItensBaseParaAutocomplete,
    getTodosFeiticosBaseParaAutocomplete,
};
