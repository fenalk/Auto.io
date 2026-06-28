# Casos de Teste — Auto.io

## 1. Objetivo

Este documento descreve os critérios de aceitação do Projeto - Auto.io, com foco no fluxo automatizado de controle e acompanhamento de clientes.

Os testes verificam se o sistema consegue cadastrar clientes, validar dados, evitar duplicidade, enviar notificações, acompanhar retornos e gerar informações básicas para monitoramento.

## 2. Pré-condições Gerais

Antes da execução dos testes, devem existir:

* workflow do n8n configurado;
* formulário de cadastro de clientes criado;
* base de dados disponível no Google Sheets ou equivalente;
* campos obrigatórios configurados no formulário;
* workflow exportado em JSON;
* ambiente do n8n acessível para consulta das execuções.

## 3. Casos de Teste

| Código | Prioridade PoC | Caso de Teste                  | Pré-condição                                           | Passos de Execução                                                                                | Resultado Esperado                                                                                        |
| ------ | -------------- | ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| CT01   | Sim            | Cadastrar cliente novo         | Formulário e base configurados                         | Preencher todos os campos obrigatórios com um cliente ainda não cadastrado e enviar o formulário. | O cliente deve ser salvo na base centralizada com os dados informados e status inicial definido.          |
| CT02   | Não            | Enviar sem nome obrigatório    | Campo Nome configurado como obrigatório                | Tentar enviar o formulário sem preencher o campo Nome.                                            | O formulário deve bloquear o envio ou indicar que o campo Nome é obrigatório.                             |
| CT03   | Sim            | Telefone com símbolos          | Workflow com normalização configurada                  | Enviar telefone no formato `(91) 99999-9999`.                                                     | O telefone deve ser salvo de forma padronizada, sem símbolos, espaços ou caracteres especiais.            |
| CT04   | Não            | E-mail com letras maiúsculas   | Workflow com normalização configurada                  | Enviar e-mail no formato `CLIENTE@EMAIL.COM`.                                                     | O e-mail deve ser salvo em letras minúsculas, como `cliente@email.com`.                                   |
| CT05   | Sim            | Cadastrar cliente já existente | Já deve existir cliente com o mesmo telefone ou e-mail | Enviar novamente um cadastro com telefone ou e-mail já existente.                                 | O sistema deve atualizar o registro existente, sem criar duplicidade.                                     |
| CT06   | Sim            | Notificação após cadastro      | Integração de notificação configurada                  | Cadastrar ou atualizar um cliente pelo formulário.                                                | O responsável deve receber uma notificação informando o cadastro ou atualização do cliente.               |
| CT07   | Sim            | Consultar execução no n8n      | Workflow executado ao menos uma vez                    | Acessar a área de execuções do n8n após o envio do formulário.                                    | A execução deve aparecer no histórico com status de sucesso.                                              |
| CT08   | Não            | Importar JSON do workflow      | Arquivo JSON exportado no repositório                  | Importar o workflow exportado em outra instância do n8n.                                          | O workflow deve ser importado corretamente, mantendo a estrutura dos nodes.                               |
| CT09   | Não            | Cliente com retorno vencido    | Base com cliente contendo data de follow-up vencida    | Executar o workflow de acompanhamento diário.                                                     | O sistema deve identificar o cliente com retorno vencido e gerar alerta para a equipe.                    |
| CT10   | Não            | Relatório por status           | Base com clientes em diferentes status                 | Executar o workflow de indicadores ou relatório.                                                  | O sistema deve apresentar a quantidade de clientes por status, como novo, pendente, convertido e perdido. |

## 4. Casos Prioritários para a PoC

Para a demonstração inicial, os casos prioritários são:

| Código | Justificativa                                    |
| ------ | ------------------------------------------------ |
| CT01   | Demonstra o cadastro de um cliente novo.         |
| CT03   | Demonstra a padronização dos dados.              |
| CT05   | Demonstra a prevenção de duplicidade.            |
| CT06   | Demonstra a automação da notificação.            |
| CT07   | Demonstra rastreabilidade pelo histórico do n8n. |

## 5. Critério de Aceitação Geral

A solução será considerada funcional quando o fluxo principal permitir preencher o formulário, executar o workflow no n8n, salvar ou atualizar o cliente na base centralizada, evitar duplicidade, notificar o responsável e permitir a consulta da execução realizada.
