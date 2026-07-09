# Instalação no Ubuntu

No processo de instalação local do n8n em Sistema Operacional Ubuntu foi recomendado a utilização do Docker.

Pela documentação do Docker tem-se os passos para a instalação do Docker Engine no Ubuntu.

Referência  a [Documentação de Instalação do Docker no Ubuntu](https://docs.docker.com/engine/install/ubuntu/?utm_source=chatgpt.com).


## Tecnologias utilizadas
Docker Enginee 
Docker Compose 
n8n
Ubuntu 26.04 LTS


# 🐳 Docker no Ubuntu + n8n 

Este guia mostra como instalar o Docker no Ubuntu e rodar o n8n de forma simples e segura usando containers.

---

## ⚙️ 1. Pré-requisitos

Atualize o sistema e instale dependências básicas:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
```

---

## 🔐 2. Adicionar chave oficial do Docker

```bash
sudo install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

---

## 📦 3. Adicionar repositório oficial

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

---

## 🔄 4. Atualizar repositórios

```bash
sudo apt update
```

---

## 🐳 5. Instalar Docker

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

## ▶️ 6. Iniciar Docker

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

✔️ Verificar status:

```bash
sudo systemctl status docker
```

---

## 🧪 7. Testar instalação

```bash
sudo docker run hello-world
```

Se aparecer mensagem de sucesso, o Docker está funcionando corretamente.

---

## 👤 8. Usar Docker sem sudo (opcional)

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 🚀 9. Rodar o n8n

Execute o container do n8n:

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

---

## 🌐 10. Acessar no navegador

Depois de rodar o container:

```
http://localhost:5678
```

---

# Resultado 
[Pós instalação do docker e n8n](../../images/workflows/image.png)
