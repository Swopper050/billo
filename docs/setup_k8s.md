# Kubernetes Deployment

In order to deploy the app, we'll need two things: a Kubernetes cluster
and a VPS for persistent data (MariaDB).

## Setting up the VPS

First set up the VPS used for MariaDB. Make sure you have a VPS where you
can log in using SSH.

### Update the VPS

```bash
sudo su -

apt update && apt upgrade -y
```

### Setup the firewall

```bash
# Enable firewall
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow OpenSSH

# Allow DB only from your k8s node
ufw allow from <k8s_node_ip> to any port 3306 proto tcp

ufw enable
ufw status
```

### Install MariaDB

```bash
sudo apt install mariadb-server -y
sudo vim /etc/mysql/mariadb.conf.d/50-server.cnf
# Update the bind address to `0.0.0.0`
sudo systemctl restart mariadb
sudo mysql_secure_installation
sudo mysql
```

Now add the database user for either staging or prod:

```mysql
CREATE DATABASE billo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'billo'@'%' IDENTIFIED BY '<PASSWORD>';
GRANT ALL PRIVILEGES ON billo_db.* TO 'billo'@'%';
FLUSH PRIVILEGES;
EXIT;
```

For staging, do the same with a separate database:

```mysql
CREATE DATABASE billo_staging_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'billo_staging'@'%' IDENTIFIED BY '<PASSWORD>';
GRANT ALL PRIVILEGES ON billo_staging_db.* TO 'billo_staging'@'%';
FLUSH PRIVILEGES;
EXIT;
```

To load a backup, first dump from the old database:

```bash
docker exec billo-db-1 sh -c 'mariadb-dump -ubillo -p"<password>" "billo_db"' > ./billo.sql
```

Then load it into the new database:

```bash
cp billo.sql billo.original.sql
sed -i 's/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_ci/g' billo.sql
sudo mysql
```

```mysql
DROP DATABASE IF EXISTS billo_db;
CREATE DATABASE billo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
mysql -u billo -p -D billo_db < billo.sql
```

## Setting up the Kubernetes cluster

### Create namespaces

Apply the namespace manifests once. This only creates the namespaces — it does **not** start any deployments:

```bash
kubectl apply -f config/k8s/billo-prod.yaml
kubectl apply -f config/k8s/billo-staging.yaml
```

The namespaces just need to exist before the first deploy. The actual deployments, services, and ingresses are applied by GitHub Actions (or manually via `kubectl apply -k config/k8s/overlays/staging`) as part of the normal deploy flow.

### Update the DB host and domains in kustomization overlays

Set the actual VPS IP address and your domain names in both overlays before deploying:

```yaml
# config/k8s/overlays/prod/kustomization.yaml
- BILLO_DB_HOST="<vps_ip>"
# Also replace app.billo.com and api.billo.com with your actual domains

# config/k8s/overlays/staging/kustomization.yaml
- BILLO_DB_HOST="<vps_ip>"
# Also replace staging.app.billo.com and staging.api.billo.com with your actual domains
```

Also replace `<dockerhub-namespace>` in `config/k8s/app/*.yaml` with your actual DockerHub namespace.

### Install cluster infrastructure (ingress-nginx, cert-manager, ClusterIssuer)

Run the setup script once per cluster. Skip if these are already installed (e.g. shared with another app on the same cluster):

```bash
chmod +x config/k8s/setup-infra.sh
./config/k8s/setup-infra.sh
```

This installs ingress-nginx and cert-manager via Helm and applies the Let's Encrypt ClusterIssuer.

### DNS

Point the following DNS records to your cluster's load balancer IP (`kubectl get services -n ingress-nginx`):

| Domain | Environment |
|---|---|
| `app.billo.com` | Production UI |
| `api.billo.com` | Production API |
| `staging.app.billo.com` | Staging UI |
| `staging.api.billo.com` | Staging API |

## Setting up GitHub Actions

### DockerHub secrets

```
DOCKERHUB_NAMESPACE=<namespace>
DOCKERHUB_USERNAME=<username>
DOCKERHUB_TOKEN=<token>
```

### Kubeconfig secrets

Export the kubeconfig for each cluster and add it as a secret:

```bash
cat ~/.kube/config | base64
```

```
KUBECONFIG_STAGING=<base64-encoded kubeconfig>
KUBECONFIG_PROD=<base64-encoded kubeconfig>
```

### Application secrets

**Production:**

```
BILLO_SECRET_KEY=<flask_secret_key>
BILLO_FERNET_SECRET_KEY=<fernet_secret_key>

BILLO_DB_USER=<db_user>
BILLO_DB_PASSWORD=<db_password>

BILLO_MAIL_SERVER=smtp.server.com
BILLO_MAIL_USERNAME=<mail_username>
BILLO_MAIL_PASSWORD=<mail_password>
BILLO_MAIL_DEFAULT_SENDER=<default_mail_address>
```

**Staging:**

```
BILLO_STAGING_SECRET_KEY=<flask_secret_key>
BILLO_STAGING_FERNET_SECRET_KEY=<fernet_secret_key>

BILLO_STAGING_DB_USER=<db_user>
BILLO_STAGING_DB_PASSWORD=<db_password>

BILLO_STAGING_MAIL_SERVER=smtp.server.com
BILLO_STAGING_MAIL_USERNAME=<mail_username>
BILLO_STAGING_MAIL_PASSWORD=<mail_password>
BILLO_STAGING_MAIL_DEFAULT_SENDER=<default_mail_address>
```
