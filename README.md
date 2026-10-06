# chathost
Partner support server for ConnectBox: the **chathost** dashboard and APIs that boxes
sync with, and **MediaBuilder** (Bolt CMS) for making OpenWell content packages.
Built on one Ubuntu server with the Ansible playbook in `ansible/`.

This project is related to ConnectBox, a content delivery device.

# Components
* chathost - dashboard and box APIs (Node, Docker container on 127.0.0.1:2820), served at `https://chat.<domain>`
* MediaBuilder - Bolt CMS with MySQL ([ConnectBox/mediabuilder](https://github.com/ConnectBox/mediabuilder), Docker, 127.0.0.1:3000), served at `https://bolt.<domain>`
* nginx in front of both, with Let's Encrypt certificates (renewed automatically)

# Building a server

**You need:** a fresh **Ubuntu 24.04** server (2 CPUs / 4 GB RAM / 30+ GB disk is a
reasonable start) that you can reach over SSH as root or a sudo user; a domain; and a
computer with Ansible (Linux, macOS or WSL).

1. **DNS:** create `chat.<domain>` and `bolt.<domain>` A records pointing at the server.
   They must resolve before step 4 - the HTTPS certificates are requested for them.
2. **Firewall:** allow inbound 22 (SSH), 80 and 443 only. The apps and MySQL listen on
   localhost and are reached through nginx.
3. **Configure** (in `ansible/`):
   * `cp inventory.example inventory` and set the server's address, `ansible_user`,
     `url=<domain>` and `email=<admin email>`.
   * `cp secrets.example.yml secrets.yml` and fill in **new** values for `password`,
     `bolt_app_secret` and `session_key` (letters/digits, 12+ characters; e.g.
     `openssl rand -hex 16`). Both files are git-ignored; optionally
     `ansible-vault encrypt secrets.yml`.
4. **Run:** `ansible-playbook -i inventory site.yml` (add `--ask-vault-pass` if you
   encrypted the secrets). The playbook stops early if the server is not Ubuntu
   24.04+ or a secret is missing or still `CHANGE_ME`. Takes about 15-20 minutes.
5. **First install only - initialise MediaBuilder's database** on the server:
   `docker exec -it php bin/console bolt:setup` (answer **NO** to "Add fixtures") and
   create Bolt's admin user when asked.

`use_https=false` in the inventory serves plain HTTP (only behind your own HTTPS load
balancer). Re-running the playbook is safe; it updates both apps from GitHub.

# Backup
Back up the MediaBuilder database (Docker volume `mediabuilder_db-data`, or
`docker exec mysql mysqldump -u root -p bolt > bolt.sql`), the MediaBuilder uploads and
exports (`/srv/connectbox/mediabuilder/public/files`) and chathost's state
(`/srv/connectbox/chathost/src/state.json`). Snapshots from your cloud provider cover all of it.

# Startup
* Open `https://chat.<domain>/dashboard` and sign in as `admin` with the `password` from
  `secrets.yml`. Boxes that sync with this server (`server_url` on the box) appear here.
* Open `https://bolt.<domain>` and sign in with the Bolt admin user from step 5 to build
  content packages. Boxes list them under *Subscribe to Content Package* (see the
  ConnectBox README, "OpenWell").

# Usage
* Teacher Setup
  * Video: https://www.loom.com/share/37d28730fba6481180362c036980c0b7?sharedAppSource=personal_library
  * A teacher account, with a valid email address should be set up in Rocketchat first.  The teacher must have a role of "User" or "Admin" if you wish for that teacher to be an Admin.
  * The Well instance must be configured to sync to the same server with Rocketchat.  When the Well is connected to the Internet, it will sync every ten minutes or may be manually sync'd at http://learn.thewell/local/chat_attachments/push_messages.php?logging=display.
  * Sync status can be confirmed in the Dashboard at http://yourrocketchatserver/dashboard
  * Create a course in the Well's Moodle instance and create the teacher account.  The teacher will never access the account here.
* Adding a Student
  * Video: https://www.loom.com/share/70ad80239e6a4b22862b88b54fe77b8c?sharedAppSource=personal_library
  * Add a student account to the course.  After the student has been added and the box syncs (see above), the teacher's Rocketchat account will receive an automated notification chat of the student connection.  The teacher may then reply and a chat will be sent to the student at the next sync.

# Additional Resources
https://docs.rocket.chat/installation/paas-deployments/aws
