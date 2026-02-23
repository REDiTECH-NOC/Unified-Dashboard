FROM grafana/grafana-oss:latest

# Copy provisioning config (datasources + dashboard provider)
COPY provisioning/ /etc/grafana/provisioning/

# Copy pre-built dashboard JSONs
COPY dashboards/ /var/lib/grafana/dashboards/
