# Call Reservation System

## Infrastructure dependencies

MongoDB and RabbitMQ use a shared base definition in
`scripts/docker-compose.yml` and local-development overrides in
`scripts/docker-compose.dev.yml`. The `COMPOSE_FILE` value in `scripts/.env`
merges both files automatically. Start the development dependencies from the
dedicated scripts directory:

```bash
cd scripts
cp .env.example .env
docker compose up -d
docker compose ps
```

When a production override is added later, it can reuse the same base without
loading development settings:

```bash
cd scripts
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The local services are available at:

- MongoDB: `mongodb://localhost:27017/?replicaSet=rs0&directConnection=true`
- RabbitMQ AMQP: `amqp://reservation:reservation@localhost:5672/call-reservation`
- RabbitMQ Management: `http://localhost:15672`

RabbitMQ Management uses `reservation` for both the default username and
password. These local-development credentials can be changed in `scripts/.env`.

MongoDB starts as a single-member `rs0` replica set so local development
supports transactions. The initialization is idempotent and persisted in the
`mongodb-data` Docker volume.

To stop the dependencies while preserving their data:

```bash
cd scripts
docker compose down
```

To also delete the MongoDB and RabbitMQ data volumes:

```bash
cd scripts
docker compose down --volumes
```
