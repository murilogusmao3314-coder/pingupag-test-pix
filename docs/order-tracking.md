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

## Código curto e prévia da equipe

Na interface, o comprador vê apenas o identificador opaco CR + 10 caracteres
alfanuméricos (12 caracteres no total). A ligação com a referência QUIZ continua
validada no servidor. Durante a exibição do Pix apenas o prefixo CR é visível;
a tela não contém o restante do código antes de o gateway confirmar o pagamento.

A URL individual usa um token assinado longo na chave `acesso`; o texto copiado
na página é o código curto. A consulta manual pelo código curto reutiliza a
capacidade local, quando presente. Em outro dispositivo, tenta resolver o código
por `GET /gateway/v1/query?action=list_transactions` sem filtro. Essa operação
read-only só funciona se o provedor oferecer listagem completa de transações. Se
ele não oferecer ou não permitir, o link assinado continua funcional, mas a
consulta manual de um código curto em um dispositivo novo não está garantida.
A resposta da listagem nunca é retornada ao cliente.

A página `/previsualizar-rastreio` apresenta exclusivamente uma prévia
interna e permite alternar entre CR-DEMO001 e CR-DEMO002. Esses códigos
não são reconhecidos na consulta pública e não comprovam pagamentos. Essa
prévia está separada do funil e marcada como interna; o link não deve ser
publicado em anúncios nem encaminhado a compradores.
