# Atsi AI Hub

Self-hosted multi-agent AI orchestration platform.

## Overview

Atsi AI Hub is a personal open-source project designed
to orchestrate specialized AI agents for practical tasks.

Initial use cases:
- Job search and application assistance
- GitHub project analysis
- Portfolio documentation and maintenance

Future use cases:
- BAFA / BAFD educational assistance
- Infrastructure monitoring
- Additional automated workflows

## Technology Stack

- Angular
- NestJS
- TypeScript
- PostgreSQL
- Redis / BullMQ
- LangGraph
- Docker Compose

## Architecture

The platform will include:
- Private administration dashboard
- Public simulated agent showcase
- REST API
- AI agent workers
- Task queue and execution history
- Human approval system

## Infrastructure

Development and deployment are performed using Docker
on a Synology NAS.

The system is designed to coexist with other services
such as personal websites, cloud storage and game servers.

## Status

Current version: V0.1 - Initial development.

See [ROADMAP.md](ROADMAP.md) for project progress.

## Security

Secrets, personal information and infrastructure credentials
must never be committed to this repository.
