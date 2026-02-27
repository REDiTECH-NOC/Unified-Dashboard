FROM grafana/grafana-oss:12.4.0

# Copy provisioning config (datasources + dashboard provider)
COPY provisioning/ /etc/grafana/provisioning/

# Copy pre-built dashboard JSONs (outside /var/lib/grafana to avoid volume shadow)
COPY dashboards/ /etc/grafana/dashboards/
