# Sample Architecture

## Purpose

Monolithic API with shared database access from all modules.

## Boundaries

- API layer should not import persistence directly
- Domain logic must remain framework-agnostic
