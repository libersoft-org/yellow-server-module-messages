# Yellow Server - Module Messages - installation and configuration

These are the installation instructions of this software for the different Linux distributions.

## 2. Module installation

Log in as "root" on your server and run the following commands to download the necessary dependencies and the latest version of this software from GitHub:

### Debian / Ubuntu Linux

```sh
apt update
apt -y upgrade
packages=("curl" "unzip" "git" "screen" "certbot")
for package in "${packages[@]}"; do
 if ! dpkg -s "$package" >/dev/null 2>&1; then
  apt -y install "$package"
 fi
done
if ! command -v bun >/dev/null 2>&1; then
 curl -fsSL https://bun.sh/install | bash
 source /root/.bashrc
fi
if ! dpkg -s mariadb-server mariadb-client >/dev/null 2>&1; then
 curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | bash
 apt -y install mariadb-server mariadb-client
fi
git clone https://github.com/libersoft-org/yellow-server-module-messages.git
cd yellow-server-module-messages/src/
```

### CentOS / RHEL / Fedora Linux

```sh
dnf -y update
packages=("curl" "unzip" "git" "screen" "certbot")
for package in "${packages[@]}"; do
 if ! rpm -q "$package" >/dev/null 2>&1; then
  dnf -y install "$package"
 fi
done
if ! command -v bun >/dev/null 2>&1; then
 curl -fsSL https://bun.sh/install | bash
 source /root/.bashrc
fi
if ! rpm -q mariadb-server mariadb-client >/dev/null 2>&1; then
 curl -sS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | bash
 dnf -y install mariadb-server mariadb-client
fi
git clone https://github.com/libersoft-org/yellow-server-module-messages.git
cd yellow-server-module-messages/src/
```

## 3. Configuration

### Create MariaDB user and database:

Log in to MariaDB client as root:

```sh
mariadb -u root -p
```

... and create a new user

```sql
CREATE USER 'yellow_module_org_libersoft_messages'@'localhost' IDENTIFIED BY 'password';
CREATE DATABASE yellow_module_org_libersoft_messages;
GRANT ALL ON yellow_module_org_libersoft_messages.* TO 'yellow_module_org_libersoft_messages'@'localhost';
```

### Create a new module settings file using:

```sh
./start.sh --create-settings
```

... and edit it to set up the database credentials and network port

### Create database tables using:

```sh
./start.sh --create-database
```

### To edit additional configuration, just edit the "settings.json" file:

- **web** section:
  - **http_port** - your HTTP server's network port (ignored if you're not running a standalone server)
  - **allow_network** - allow to run the web server through network (not just localhost)
- **database** section:
  - **host** - database host name
  - **port** - database network port
  - **user** - database user name
  - **password** - database password
  - **name** - database name
- **other** section:
  - **log_file** - the path to your log file (ignored if log_to_file is false)
  - **log_to_file** - if you'd like to log to console and log file (true) or to console only (false)

## 4. Start the module

a) to start the module in **console**:

```bash
./start.sh
```

b) to start the module in **console** in **hot reload** (dev) mode:

```bash
./start-hot.sh
```

c) to start the module in **screen**:

```bash
./start-screen.sh
```

d) to start the module in **screen** in **hot reload** (dev) mode:

```bash
./start-hot-screen.sh
```

To detach screen press **CTRL+A** and then **CTRL+D**.

To stop the module just press **CTRL+C**.
