# dont-code

## The self-service application platform
Once setup,

Your developers will access to
- A Mongo database with a set of APIs
- A Document repository, with a set of APIs
- A set of libraries to access, display, edit, transform data and documents  
- A configuration based application development environment
- A plugin factory to extend the platform
- With a connection to LLMs a chat-based plugin development environment

Your admin will access to
- A repository manager to select available apps and plugins
- A configuration based application designer
- An AI-based application designer
- A one-click application deployment

Your users will access to
- A dashboard of available applications

## How to write a new application ?

There are several ways to develop and deploy an application with Dont-code:

1. You write a json file describing your application
  - Data model & sources
  - Possible actions on data
  - Workflows
  - No token costs
2. You chat with the AI designer
  - It can handle for you the application config
  - Very low token costs as the AI agent only needs to produce the config file
  - Limited to existing Dont-code capabilities
3. You generate a new plugin / workflow
  - Either through development or with AI designer, you can develop and instantly generate new plugins or workflows specific to your need
  - Plugins benefit from the Dont-code platform, for example data access, dynamic forms...
  - Once generated, it is compiled and deployed.
  - AI is used only for generation, but not needed to run your application
  - Medium token cost, during the code generation
  - Adds any kind of deterministic feature can be designed like this
4. You provide direct access to LLM in your app
  - Dont-code supports AI UI protocols and platforms like ag-ui, a2ui, Open-Json-Ui & mcp-ui
  - Your application uses and displays AI agents in runtime
  - Large token cost, as each user will consume tokens
  - No limits on the features you can add

