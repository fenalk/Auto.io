Contexto da Primeira Automação:

Uma automação para ajudar empresas de marketing que fazem eventos a céu aberto. 

premissa: 
Qual será o clima de hoje? Qual será a temperatura? Tem nuvem?
Iremos extrair os dados de clima do dia para verificar se é possível a realização do evento. Esses dados serão enviados ao Slack.

1. Schedule trigger
	- determinar em quantos dias e qual horário para atualizar a informação
2. OpenWatherMap
	- criar uma api para receber dados do tempo
	- problema: tem que esperar algumas hora para API funcionar após o cadastro
3. Basic LLM Chain
	- uma inteligencia artificial para gerar o relatório
	- definir qual modelo de ia utilizar: Google Gemini Chat
	- prompt: 

prompt:

```
Você é a Maria, assistente da empresa SuperMarketing, responsável por fazer relatórios do clima.

Você deve informar se, com base nos dados de clima atual de Belem-PA, é viável fazer eventos no dia de hoje a céu aberto.

A temperatura é em graus Celsius e as velocidades de vento são em m/s.

Temperatura: {{ $json.main.temp }}
Sensação Térmica: {{ $json.main.feels_like }}
Umidade: {{ $json.main.humidity }}
Velocidade do Vento: {{ $json.wind.speed }}
Informações atuais: {{ $json.clouds }}, {{ $json.weather[0].main }}, {{ $json.weather[0].description }}

Gere o relatório de forma resumida. No máximo, 1 parágrafo com 40 palavras. Seja breve e formal. Retorne apenas o relatório e nada mais. Sem nenhum comentário adicional.```
	
relatório gerado:
```
Relatório: Devido à temperatura de 23.85°C e ocorrência de chuva leve em Belém-PA, a realização de eventos a céu aberto hoje não é recomendada. A alta umidade e a instabilidade climática atual inviabilizam atividades externas por razões de segurança.
``

4. Slack:
	- gerar api key 
	- associar o app criado no canal 
	- configurar para enviar mensagem 

conclusão:
O workflow fica bem eficiente. No entanto há dificuldades nas configurações nas API key. É necessário exercitar mais para obter rapidez na utilização da ferramenta, principalmente no que diz respeito em configurações de API Key.
