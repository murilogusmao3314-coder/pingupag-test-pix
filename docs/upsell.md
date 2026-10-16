# Pós-compra: serviço prioritário opcional

A rota `/upsell` substitui a antiga oferta física por um serviço opcional de
R$ 28,63 (2863 centavos). `/upsell1` redireciona para `/upsell` apenas por
compatibilidade com links anteriores; não há mais produtos do kit nesse fluxo.

## Fluxo preservado

1. Checkout existente gera o Pix do pedido principal, com os preços corrigidos
   apenas para o fardo: OB2 R$ 19,90. O front continua R$ 9,90 / R$ 18,94,
   e o copo adicional continua R$ 19,90, conforme código já existente.
2. O gateway precisa retornar `approved` no pagamento principal. Só então
   `checkPixPayment` emite o acesso individual assinado, que é armazenado
   antes de qualquer navegação (código `CR` visível no rastreio).
3. A autorização curta do upsell mantém a referência principal e seu código de
   acesso opaco, sem CPF, CEP, nome ou endereço em texto puro. A rota
   `/upsell` revalida a transação e a correspondência com essa referência.
4. **Recusar** chama `continueToTracking`, dispensa a oferta e navega
   `/rastrear?acesso=<acesso_original>`.
5. **Aceitar** abre um segundo Pix de R$ 28,63 para o serviço opcional.
   Sua descrição contém a referência do pedido principal. Apenas a
   aprovação real dessa segunda cobrança conclui a contratação e chama
   a mesma `continueToTracking` com o mesmo acesso original.
6. O upsell não modifica `/rastrear`, `/pedido`, o gerador
   `codeForPaidReference`, o token inicial, o ID original ou o banco
   (este projeto não utiliza banco). `kind: "upsell"` impede que
   a confirmação do adicional substitua o código principal salvo.

## Limites técnicos e obrigações comerciais

O gateway atual oferece `POST /transaction` para novas cobranças, não
um endpoint documentado para aumentar uma cobrança Pix já aprovada.
Portanto, o serviço **exige outra transação financeira**: ela é relacionada
ao pedido principal pela descrição e pelos dados criptografados de compra;
não é uma atualização da mesma cobrança nem cria um novo pedido de
rastreamento. Não afirmar liquidação do extra sem confirmação do gateway.

Sem armazenamento transacional persistente e webhook, não há garantia forte
de cobrança única entre diferentes dispositivos nem confirmação automática
de fulfillment interno. O controle de 1x é de sessão/navegador e o gateway
precisa ser auditado caso o cliente abandone um Pix já gerado.

Garantia estendida a 90 dias, processamento prioritário e primeira resposta
em até 2 horas devem ser honrados pela operação real da loja; o código
não aciona logística física nem atendimento automaticamente. O serviço
**não acelera a transportadora por si só** e não pode servir como condição
para o rastreio ou entrega do pedido pago.

Os testes unitários e estáticos cobrem a validação do Pix principal, os
valores, a descrição vinculada, a saída comum, a oferta opcional e as
rotas. Uma simulação de gateway não substitui testes de Pix real.
