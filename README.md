# Pingupag Test Pix

## Gateway Pix

Endpoint definido para este projeto: `https://pagamento-processador.org.ua/gateway/v1/transaction`.
As requisições saem exclusivamente de `src/lib/pix.functions.ts`, com `PINGUPAG_API_KEY`
armazenada no servidor e enviada no cabeçalho `X-API-Key`. O contrato de payload existente
foi preservado; o total continua em centavos. Redirecionamentos do gateway são rejeitados.

Os testes de integração usam respostas simuladas e não geram cobranças. O contrato e a
disponibilidade do novo gateway ainda precisam ser validados com o provedor em ambiente de teste.

## Quiz

As nove perguntas e 32 alternativas seguem o material de referência. Respostas, pergunta atual
e prazo visual são mantidos apenas na sessão da aba, sem armazenar dados do checkout.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/60b27cc8-567b-4cde-866e-08b42835ad09).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
