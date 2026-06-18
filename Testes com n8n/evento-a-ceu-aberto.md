Contexto da Primeira Automação:

Uma automação para ajudar empresas de marketing que fazem eventos a céu aberto. 

premissa: 
Qual será o clima de hoje? Qual será a temperatura? Tem nuvem?
Iremos extrair os dados de clima do dia para verificar se é possível a realização do evento. Esses dados serão enviados ao Slack.

1. Schedule trigger
	- determinar em quantos dias e qual horário para atualizar a informação
2. OpenWatherMap
	- criar uma api para receber dados do tempo
	- problema: tem que esperar algumas hora para API funcionar após o cadastro.