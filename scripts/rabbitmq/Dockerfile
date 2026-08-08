FROM rabbitmq:4.2.0-management-alpine

ADD --chown=rabbitmq:rabbitmq \
    https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v4.2.0/rabbitmq_delayed_message_exchange-4.2.0.ez \
    /opt/rabbitmq/plugins/rabbitmq_delayed_message_exchange-4.2.0.ez

RUN echo '[rabbitmq_delayed_message_exchange,rabbitmq_management,rabbitmq_prometheus].' \
    > /etc/rabbitmq/enabled_plugins
