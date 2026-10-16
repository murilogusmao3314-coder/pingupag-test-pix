# Acompanhamento de pedidos (sem banco de dados)

O código MST é derivado da referência QUIZ UUID do Pix com HMAC-SHA256,
truncado em 96 bits e assinado no servidor usando PINGUPAG_API_KEY. É estável
para a mesma venda e não pode ser forjado sem a chave. Não contém endereço,
CPF, email ou segredo. Trate-o como link de acesso ao acompanhamento.

O código é emitido **somente depois** de a consulta existente ao gateway
confirmar aprovação com a referência e o valor do comprovante assinado. O
navegador armazena apenas códigos públicos locais (até 20) para facilitar
a retomada. A rota `/pedido` faz nova consulta antes de exibir sucesso;
`/rastrear?codigo=...` permite consultar manualmente, inclusive em outro
dispositivo. Toda consulta valida o HMAC no servidor e consulta o gateway por
referência, sem banco ou estado global.

A linha do tempo só avança a partir de timestamp **explícito de aprovação**
fornecido pelo gateway, contendo fuso horário. Sem esse dado verificável, a
etapa inicial permanece até a origem disponibilizá-lo. Estados internos não
representam comprovantes de movimentação física nem de entrega.

Endereço, CEP e descrição só são exibidos se o registro da transação do próprio
gateway os devolver. O comprovante Pix inicial contém dados criptografados,
mas expira em 24h e não é um banco persistente: não há como recuperar os dados
originais em outro dispositivo se o gateway não os devolver. Não inventar dados
nem estender o prazo do comprovante existente.

Dependências e limites: a API /gateway/v1/query deve estar acessível e
continuar retornando transações por external_id. Rotacionar a PINGUPAG_API_KEY
invalida códigos existentes (a menos que se mantenha a chave antiga para
verificação). Se o cliente abandonar a compra e voltar após a expiração do
comprovante sem ter recebido ou salvo o código, a descoberta automática não
é possível sem armazenamento externo ou informação da venda do gateway.
Não existe webhook de confirmação nem mecanismo de e-mail no repositório atual.
