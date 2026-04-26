# caderno

> _antes de tudo, respira._

Um caderno breve e anônimo para observar como você está chegando — e
encontrar um caminho para conversar com quem possa escutar.

**Projeto de extensão universitária aberto à comunidade.** Gratuito,
sem coleta de dados pessoais, com dados agregados publicados sob
licença aberta.

---

## sobre

**caderno** é um projeto de extensão criado pelo curso de **Engenharia
de Software**, em parceria com o curso de **Psicologia da Faculdade
Católica Catarinense**.

A proposta é simples: oferecer à comunidade um espaço breve e cuidadoso
para que cada pessoa observe como está se sentindo e, a partir disso,
seja direcionada com clareza para o atendimento mais adequado dentro da
rede de apoio em saúde mental — plantão psicológico, acolhimento em
ansiedade, escuta de sofrimento persistente, conversas em grupo ou
oficinas temáticas.

A pesquisa de campo gera dados **públicos e agregados** sobre como a
comunidade chega. Isso ajuda os profissionais de psicologia a entender
padrões coletivos sem expor histórias individuais — e devolve à própria
comunidade aquilo que ela contribuiu.

## como funciona

**Para quem chega pelo QR Code (uso principal):**

1. Abre o caderno e percorre sete passos curtos
2. Responde como está se sentindo, o que tem aparecido nas últimas
   semanas, há quanto tempo isso te acompanha, o que procura ali, e
   se já conversou com alguém
3. Recebe uma indicação de caminho — qual serviço da rede de apoio
   combina com o momento
4. Pode acessar _o coletivo_ (`/coletivo.html`), página pública com
   os dados agregados de todos que passaram por ali

Tempo total estimado: três minutos.

**Para a equipe de pesquisa em Psicologia:**

Os dados agregados ficam sempre disponíveis em `/coletivo.html`, com
distribuições por humor, temas, hora do dia e caminhos sugeridos. A
atualização é em tempo real.

## privacidade

Esta é a primeira decisão de projeto, não a última.

- **Nunca** coletamos nome, e-mail, telefone, IP, user-agent ou
  impressão digital de dispositivo
- Registramos apenas: humor declarado, temas marcados, hora local,
  fuso horário, duração de cada passo e eventos de interação (clique,
  foco, abandono)
- O campo de texto livre _"se pudesse escolher uma palavra…"_ **não
  tem o conteúdo armazenado** — apenas o número de letras, como sinal
  fraco de engajamento
- Os dados agregados são **públicos desde o primeiro registro**, sob
  Creative Commons BY-SA 4.0
- O acesso à página de dados aparece naturalmente após concluir o
  caderno; o link é compartilhável — a privacidade está nos dados,
  não em quem os vê

## aviso

Este caderno **não substitui avaliação clínica**. As indicações aqui
oferecidas são pontos de partida para a conversa, não diagnósticos.

Em situação de crise ou risco, procure ajuda imediatamente:

- **CVV — Centro de Valorização da Vida**: ligue **188**
  (24h, gratuito) ou converse em [cvv.org.br](https://www.cvv.org.br)
- **SAMU**: **192**
- **Emergência psiquiátrica**: pronto-socorro mais próximo

## tecnologia

| camada     | escolha                                                    |
|------------|------------------------------------------------------------|
| backend    | [Drogon](https://github.com/drogonframework/drogon) (C++17), SQLite embarcado |
| frontend   | HTML + CSS + JavaScript vanilla, sem framework             |
| tipografia | Fraunces + Newsreader (Google Fonts, eixos variáveis)      |
| infra      | Docker multi-stage; estático servido pelo próprio Drogon   |

Decisões deliberadas: nenhuma dependência JavaScript no frontend,
nenhum tracker de terceiros, nenhuma chamada externa fora dos
provedores de fonte. O cliente todo carrega abaixo de 35 KB sem
contar as fontes.

## como rodar

Pré-requisito: **Docker Desktop** (Windows / macOS) ou **Docker
Engine** (Linux).

```bash
# clonar
git clone <url-do-repo>
cd fc-projeto-ex-1

# subir (primeira vez compila o Drogon — ~10-15 min)
docker compose up -d --build

# acessar
# http://localhost:8088
```

Builds seguintes usam o cache e levam segundos.

### desenvolvimento de frontend (sem rebuild a cada save)

Descomente a linha de bind-mount em `docker-compose.yml`:

```yaml
volumes:
  - caderno-db:/data
  - ./public:/app/public:ro    # <-- aqui
```

Depois disso, qualquer alteração em `public/` aparece com F5 no
navegador.

### comandos úteis

```bash
docker logs -f caderno                           # logs em tempo real
docker exec -it caderno sqlite3 /data/caderno.db # inspecionar o banco
docker compose down                              # parar e remover container
docker volume rm caderno-db                      # zerar todos os dados
```

### endpoints

| método | rota                | descrição                                |
|--------|---------------------|------------------------------------------|
| GET    | `/`                 | o caderno (questionário de sete passos)  |
| GET    | `/coletivo.html`    | dados públicos agregados                 |
| POST   | `/api/submit`       | recebe submissões anônimas (sendBeacon)  |
| GET    | `/api/stats`        | estatísticas agregadas (cache de 60s)    |

## estrutura

```
fc-projeto-ex-1/
├── Dockerfile               build multi-stage Drogon → runtime
├── docker-compose.yml
├── CMakeLists.txt
├── config.json              configuração do Drogon
├── main.cc                  inicializa o schema SQLite no boot
├── controllers/
│   ├── ApiController.h
│   └── ApiController.cc     POST /api/submit · GET /api/stats
└── public/                  frontend
    ├── index.html           o caderno (sete passos)
    ├── coletivo.html        dados públicos
    ├── favicon.svg
    ├── css/style.css
    └── js/
        ├── main.js          questionário + tracking anônimo
        └── coletivo.js      renderização dos dados agregados
```

## o coletivo

A página `/coletivo.html` apresenta, em tempo real:

- **total** de pessoas que completaram o caderno
- **como chegam** — distribuição do humor de chegada
- **o que aparece** — temas mais marcados nas últimas semanas
- **quando se ouvem** — distribuição de horários ao longo do dia
- **caminhos** — para onde a escuta foi direcionada

Estes dados são liberados sob **Creative Commons BY-SA 4.0**. Você
pode copiar, usar em pesquisas, citar e republicar — desde que
atribua e mantenha a mesma licença.

## parceria

| instituição                          | curso                  |
|--------------------------------------|------------------------|
| Faculdade Anhanguera    | Engenharia de Software |
| Faculdade Católica Catarinense       | Psicologia             |

- **Coordenação técnica**: equipe de Engenharia de Software
- **Coordenação clínica e validação dos protocolos de roteamento**:
  equipe de Psicologia da Católica Catarinense
- **Acesso ao público**: distribuição de QR Codes em pontos de
  encontro da comunidade

## licença

- **Código-fonte**: MIT
- **Dados agregados publicados em `/coletivo.html`**: Creative
  Commons BY-SA 4.0

---

_um caderno breve · medimos apenas interações, nunca você_
