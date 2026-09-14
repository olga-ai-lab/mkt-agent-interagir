## Objetivo
Ocultar o card **"Regulatório"** do editor de composição de marca (`BrandCompositionEditor.tsx`) no frontend, preservando todo o código e funcionalidade para futura reativação.

## Alteração
No arquivo `src/components/marketing/BrandCompositionEditor.tsx`, envolver o bloco `<Card>` com título "Regulatório" (linhas 843–902) em uma condição `false && (...)` para que o React não o renderize, mantendo o código intacto.

## Resultado esperado
- O card "Regulatório" deixa de aparecer na interface de edição de posts.
- Todo o código, handlers e estado relacionados permanecem no arquivo, prontos para serem reativados removendo a condição `false &&`.