FROM grafana/grafana-oss:latest

# Copy provisioning config (datasources + dashboard provider)
COPY provisioning/ /etc/grafana/provisioning/

# Copy pre-built dashboard JSONs (outside /var/lib/grafana to avoid volume shadow)
COPY dashboards/ /etc/grafana/dashboards/
