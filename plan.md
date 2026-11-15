# Plano — publicação permanente do site SpaceX

## Abordagem
Migrar o site existente do usuário para o projeto Web gerenciado pela Manus sem redesenhar nem substituir a experiência. Manter React + TypeScript + Vite no frontend, Express para as rotas já existentes em `api/`, Firebase Authentication para login Google e Firestore para perfis e publicações favoritas. Conservar o estilo, componentes, conteúdo e assets fornecidos; integrar as correções de consultas Firestore filtradas por UID e corações vermelhos já validadas no código-fonte.

## Arquitetura e estrutura
- `src/`: aplicação React, componentes, contexto de autenticação Firebase e serviços.
- `api/`: endpoints Express atuais.
- `server.ts`: inicialização Express, middleware Vite em desenvolvimento, assets compilados em produção e rota de saúde sem autenticação.
- `public/manus-routes.json`: manifesto de páginas servido pela mesma origem; a aplicação é SPA de uma rota (`/`), e endpoints API não são páginas.
- `Dockerfile`: instala dependências fixadas, compila frontend e inicia o servidor Express em produção.
- Firebase permanece como provedor externo já configurado no app; não migrar autenticação ou dados para outro serviço.

## Execução e publicação
Declarar Node/npm e dependências com lockfile reproduzível, configurar a aplicação para ouvir `PORT` em `0.0.0.0` com padrão 3000, adicionar endpoint de saúde e declarar implantação em contêiner do projeto com servidor habilitado. Antes de iniciar Preview, fornecer o manifesto de rotas. Depois de validar o build e o serviço, gravar um checkpoint Manus e solicitar publicação explícita, confirmando o resultado antes de informar a URL permanente.

## Download e duração de mídia
No cliente, tratar `temp_download_url` válido como link de download preferido; na ausência ou expiração, construir a URL do arquivo original com `server` + `/data` + `path`, deixando `temp_url` (prévia temporária) como último recurso quando não há caminho original. No endpoint do servidor, não entregar resposta HTML/texto como se fosse arquivo de mídia, identificar payload de erro e experimentar outros mirrors oficiais n1–n4 para um caminho original quando a origem declarada falhar. No player, sincronizar a duração a partir de `durationchange`, metadados/dados carregados, progresso, tempo de reprodução e término, evitando reter metadados iniciais incompletos.

Inspeção pública da API Pawchive confirmou que detalhes de post em `/api/v1/{service}/user/{creatorId}/post/{postId}` podem retornar anexos `deferred` com URLs temporárias, enquanto `preview_only` pode marcar uma miniatura separada; estes campos não devem ser tratados como o mesmo arquivo original. Também foram observados caminhos em `/data/...` retornando `404 text/plain` e outro arquivo retornando os bytes e `Content-Type` corretos de PNG. Três vídeos deferred de exemplo foram verificados com `ffprobe`; a duração reportada pelo container e pelas trilhas coincidia (~4,9 s), portanto a correção do player passa a acompanhar eventos de metadados/seekable/progresso em vez de assumir uma duração fixa.

## Direção visual
Preservar a identidade espacial escura já implementada, a tipografia e componentes atuais; sem introduzir nova direção de arte. Reproduzir a referência fornecida pelo usuário como reveal de entrada nos elementos que alcançam o viewport: blur para nitidez, movimento vertical curto, opacidade progressiva e atraso escalonado nos cartões. Durante a rolagem aplicar somente um blur breve e sutil, e retornar à nitidez ao parar; respeitar `prefers-reduced-motion`. A mudança visual dos favoritos mantém os corações ativos vermelhos.
