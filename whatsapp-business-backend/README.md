# WhatsApp Business Backend

Este projeto é uma aplicação backend simples para testar a API do WhatsApp Business. Ele permite que um número de teste receba mensagens através do WhatsApp Business Manager.

## Estrutura do Projeto

```ini
whatsapp-business-backend
├── src
│   ├── app.js                  # Ponto de entrada da aplicação
│   ├── controllers             # Controladores para gerenciar a lógica de negócios
│   │   └── whatsappController.js
│   ├── services                # Serviços para interagir com a API do WhatsApp Business
│   │   └── whatsappService.js
│   ├── routes                  # Definição das rotas da API
│   │   └── whatsappRoutes.js
│   ├── config                  # Configurações da API do WhatsApp Business
│   │   └── whatsapp.js
│   └── utils                   # Utilitários, como logger
│       └── logger.js
├── package.json                # Configuração do npm
├── .env.example                # Modelo para variáveis de ambiente
├── .gitignore                  # Arquivos e pastas a serem ignorados pelo Git
└── README.md                   # Documentação do projeto
```

## Instalação

1. Clone o repositório:

```sh
git clone <URL_DO_REPOSITORIO>
```

2. Navegue até o diretório do projeto:

```sh
cd whatsapp-business-backend
```

3. Instale as dependências:

```sh
npm install
```

4. Renomeie o arquivo `.env.example` para `.env` e preencha com suas credenciais da API do WhatsApp Business.

## Uso

1. Inicie o servidor:

```text
npm start
```

2. Envie uma requisição para a rota de envio de mensagens, utilizando um cliente HTTP como Postman ou cURL, ou rode npm test para enviar uma mensagem de teste automaticamente.

## Contribuição

Sinta-se à vontade para contribuir com melhorias ou correções. Abra uma issue ou envie um pull request!

## Licença

Este projeto está licenciado sob a MIT License. Veja o arquivo LICENSE para mais detalhes.