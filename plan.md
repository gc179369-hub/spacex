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

## Direção visual
Preservar a identidade espacial escura já implementada, a tipografia e componentes atuais; sem introduzir nova direção de arte. Reproduzir a referência fornecida pelo usuário como reveal de entrada nos elementos que alcançam o viewport: blur para nitidez, movimento vertical curto, opacidade progressiva e atraso escalonado nos cartões. Durante a rolagem aplicar somente um blur breve e sutil, e retornar à nitidez ao parar; respeitar `prefers-reduced-motion`. A mudança visual dos favoritos mantém os corações ativos vermelhos.
