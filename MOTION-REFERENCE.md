# Referência de motion blur

Fonte visual fornecida pelo usuário: https://devpbr.vercel.app/ (Minecraft Vibrant Visuals).

Nas duas passagens de rolagem observadas, os blocos que entram no viewport apresentam um blur gaussiano forte por um instante, combinado a baixa opacidade e pequeno deslocamento vertical. A primeira captura durante a rolagem mostra o conteúdo deliberadamente desfocado; quando a transição termina, texto e cartões voltam a ficar totalmente nítidos. Blocos grandes e cartões da seção surgem em sequência, criando sensação de revelação progressiva ao descer a página.

Aplicação planejada: implementar gatilhos de entrada por IntersectionObserver, gradiente de intensidade do blur para blur(0), opacidade 0→1 e deslocamento vertical curto com stagger discreto nos cartões. Evitar aplicar blur global contínuo ao rolamento para não comprometer leitura/performance; deixar os elementos claros após o ingresso. Respeitar `prefers-reduced-motion` e reaplicar somente em elementos que entram pela primeira vez.
