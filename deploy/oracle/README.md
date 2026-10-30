# Desplegar UPG Monitor en Oracle Cloud (Always Free)

Guía para montar la app en una VM gratuita de Oracle Cloud con HTTPS, arranque
automático y backups diarios. Tiempo estimado: 30–45 minutos.

**Lo que vas a tener:** Ubuntu en una VM Ampere A1 (ARM) → Caddy (HTTPS automático) →
la app en `127.0.0.1:3077` como servicio `systemd`, con la base SQLite en
`/var/lib/upgsuptime` y un backup diario en `/var/backups/upgsuptime`.

## Cuánto necesita la app

Medido con un build de producción:

| | Memoria | Tiempo |
|---|---|---|
| `npm run build` (pico) | ~2,1 GB | ~1,5 min con 4 núcleos |
| App corriendo | ~320 MB | — |

**Instancia recomendada:** `VM.Standard.A1.Flex` con **1 OCPU y 6 GB**. Desde junio de
2026 el Always Free de Ampere A1 es de **2 OCPU / 12 GB en total** (antes era 4/24), así
que con esto usás la mitad. La VM AMD `E2.1.Micro` (1 GB) sirve como alternativa si no hay stock de A1 (ver abajo), con builds lentos.

> Los límites del free tier cambian: confirmalos en
> [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
> antes de crear la instancia.

## 1. Crear la cuenta

1. Registrate en **<https://www.oracle.com/cloud/free/>**. Pide tarjeta para verificar
   identidad (no prepaga ni virtual); no cobra mientras uses recursos Always Free.
2. Elegí bien la **región principal (home region)**: no se puede cambiar y la
   disponibilidad de Ampere A1 varía. Una región cercana a tus usuarios o a los sitios
   que vas a monitorear.

## 2. Crear la VM

Consola: **<https://cloud.oracle.com/compute/instances/create>** (o menú ☰ → Compute →
Instances → *Create instance*). Guía oficial:
[Creating an Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm).

1. **Image:** *Change image* → **Canonical Ubuntu 24.04** (o 22.04). Elegí la variante
   *aarch64* si te la ofrece.
2. **Shape:** *Change shape* → *Ampere* → **VM.Standard.A1.Flex** → **1 OCPU, 6 GB**.
3. **Networking:** dejá que cree una VCN nueva con subred pública y **asignar IP pública**.
4. **SSH keys:** *Generate a key pair for me* y **descargá la clave privada** (o subí la tuya).
5. *Create*. Si aparece **"Out of capacity"**, reintentá más tarde o probá otro
   *Availability Domain*; es frecuente en regiones populares.

Cuando esté *Running*, anotá la **IP pública** que figura en la página de la instancia.

### Si da "Out of capacity"

Oracle no tiene capacidad ARM libre en ese momento (muy común). Desde **Cloud Shell**
(ícono `>_` arriba a la derecha de la consola; ya tiene la CLI configurada) hay un script
con dos opciones.

Antes: si al primer intento descargaste la clave pública (`ssh-key-….key.pub`), subila
a Cloud Shell (menú ⚙️ → *Upload*); si no, el script genera una clave nueva. Y tiene que
existir una subred pública: si no hay, creala con *Networking → Virtual cloud networks →
Start VCN Wizard → Create VCN with Internet Connectivity*.

```bash
curl -fsSL https://raw.githubusercontent.com/mnavarrosqa/upgsuptime/main/deploy/oracle/create-instance.sh -o create-instance.sh
```

**Opción A — esperar una A1 (recomendada):** reintenta cada ~1,5 minutos hasta que haya
lugar. Cuida el *rate limit* de la API: si Oracle responde "TooManyRequests", espera
cada vez más (hasta 15 min).

```bash
bash create-instance.sh ssh-key-AAAA-MM-DD.key.pub    # o sin argumento para generar una clave
```

**Opción B — una AMD E2.1.Micro ya:** casi siempre hay stock y también es Always Free
(se pueden tener dos). Tiene 1 GB de RAM y 1/8 de OCPU: alcanza para correr la app,
pero compilar es lento (el instalador agrega 4 GB de swap automáticamente).

```bash
TYPE=micro bash create-instance.sh ssh-key-AAAA-MM-DD.key.pub
```

**Opción C — las dos alternadas:** intenta A1 y micro por turnos (misma cantidad de
pedidos) y se queda con la primera que salga.

```bash
TYPE=any bash create-instance.sh ssh-key-AAAA-MM-DD.key.pub
```

Las dos pueden convivir (se llaman `upgsuptime` y `upgsuptime-micro`): podés arrancar
con la micro y, si más adelante sale la A1, mudarte copiando el backup de la base.

Cuando lo logra, muestra la **IP pública**. Si generó una clave nueva, descargá
`~/.ssh/upgsuptime` (⚙️ → *Download*): es la privada para entrar por SSH.

Cloud Shell se cierra tras ~20 minutos sin que toques el teclado; si pasa, volvé a
correr el comando (no duplica instancias: si ya existe, solo muestra su IP).

#### Dejarlo reintentando horas o días en otro servidor

Si la región no tiene capacidad por un buen rato, corré el script en cualquier Linux
que esté siempre prendido (un VPS, una Raspberry, tu servidor actual):

1. Instalá la CLI de Oracle:
   `bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)" -- --accept-all-defaults`
   y abrí una terminal nueva.
2. `oci setup config`. Te pide:
   - **User OCID:** consola → ícono de perfil → *My profile* → copiar *OCID*.
   - **Tenancy OCID:** ícono de perfil → *Tenancy* → copiar *OCID*.
   - **Region:** la tuya (por ejemplo `sa-santiago-1`).
   - Generar una API key nueva: **Y**, el resto con Enter.
3. Subí la clave pública que generó: *My profile* → *API keys* → *Add API key* →
   *Paste a public key* → pegá el contenido de `~/.oci/oci_api_key_public.pem`.
4. Copiá tu `ssh-key-….key.pub` a ese servidor y lanzalo en segundo plano:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/mnavarrosqa/upgsuptime/main/deploy/oracle/create-instance.sh -o create-instance.sh
   TYPE=any nohup bash create-instance.sh ssh-key-AAAA-MM-DD.key.pub > create-instance.log 2>&1 &
   tail -f create-instance.log     # Ctrl+C deja de mirar; el script sigue
   ```

   Sigue aunque cierres la sesión SSH. Para pararlo: `pkill -f create-instance.sh`.

## 3. Abrir los puertos 80 y 443 en Oracle

Oracle tiene **dos firewalls**: el de la red (Security List) y el del sistema operativo.
El script se ocupa del segundo; este paso es el primero.

1. En la página de la instancia → *Primary VNIC* → clic en la **Subnet** → *Security* →
   **Default Security List**.
2. *Add Ingress Rules*, dos reglas iguales salvo el puerto:
   - Source CIDR: `0.0.0.0/0` · IP Protocol: `TCP` · Destination Port Range: **`80`**
   - Source CIDR: `0.0.0.0/0` · IP Protocol: `TCP` · Destination Port Range: **`443`**

Referencia: [Security Lists](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm).

## 4. Apuntar tu dominio a la VM

En el proveedor de tu dominio, creá un registro **A**, por ejemplo
`monitor.tudominio.com` → IP pública de la VM. Esperá a que resuelva
(`ping monitor.tudominio.com` debe mostrar esa IP). Caddy lo necesita para emitir el
certificado HTTPS.

## 5. Instalar

Conectate por SSH (el usuario de las imágenes Ubuntu es `ubuntu`):

```bash
ssh -i ruta/a/tu-clave.key ubuntu@IP_PUBLICA
```

Y en la VM:

```bash
curl -fsSL https://raw.githubusercontent.com/mnavarrosqa/upgsuptime/main/deploy/oracle/install.sh -o install.sh
DOMAIN=monitor.tudominio.com sudo -E bash install.sh
```

El script instala Node 22, Caddy y SQLite; abre 80/443 en el firewall del sistema; crea
2 GB de swap; clona el repo en `/opt/upgsuptime`; genera `.env` con secretos aleatorios;
compila; y deja la app, el HTTPS y el backup diario funcionando. Se puede volver a correr
sin perder datos ni el `.env`.

Al terminar, abrí **https://monitor.tudominio.com** y creá la cuenta de administrador.
Después podés impedir que otros creen cuentas de administrador agregando
`DISABLE_SETUP=true` al `.env`.

## 6. Configurar (opcional)

Editá `/opt/upgsuptime/.env` con `sudo nano /opt/upgsuptime/.env` y reiniciá con
`sudo systemctl restart upgsuptime`:

- **Alertas por correo:** completá las variables `SMTP_*`.
- **Ubicación de los chequeos:** `CHECKS_LOCATION="Oracle Cloud · São Paulo"`.

## Actualizar

```bash
sudo bash /opt/upgsuptime/deploy/oracle/update.sh
```

Hace un backup, trae `main`, instala dependencias exactas (`npm ci`), aplica el esquema
de base de datos, compila y reinicia. Descarta cambios locales en `/opt/upgsuptime`
(nunca se editan a mano allí; el `.env` se conserva), así que no vuelve a aparecer el
error *"Your local changes … would be overwritten by merge"*.

Si `db:push` pregunta por pérdida de datos (por ejemplo al eliminar una tabla que dejó
de usarse), leé qué tabla es antes de confirmar.

## Operación

| Qué | Comando |
|---|---|
| Ver logs en vivo | `journalctl -u upgsuptime -f` |
| Estado | `systemctl status upgsuptime` |
| Reiniciar | `sudo systemctl restart upgsuptime` |
| Backup ahora | `sudo -u upg upgsuptime-backup` |
| Ver backups | `ls -lh /var/backups/upgsuptime` |
| Logs de Caddy / HTTPS | `journalctl -u caddy -f` |

**Restaurar un backup:**

```bash
sudo systemctl stop upgsuptime
gunzip -c /var/backups/upgsuptime/uptime-AAAAMMDD-HHMMSS.db.gz | sudo -u upg tee /var/lib/upgsuptime/uptime.db >/dev/null
sudo systemctl start upgsuptime
```

Los backups quedan en el mismo disco que la base. Para protegerte de perder la VM,
copiá de vez en cuando alguno a tu computadora:
`scp -i tu-clave.key ubuntu@IP_PUBLICA:/var/backups/upgsuptime/uptime-*.db.gz .`

## Avisos de Oracle que conviene conocer

- **Instancias inactivas:** Oracle puede recuperar instancias Always Free "ociosas":
  si durante 7 días el percentil 95 de CPU, red y memoria (en A1) queda por debajo del
  20 %. Esta app usa poco de todo, así que **podría** encajar en esa definición. Pasar
  la cuenta a **Pay As You Go** (*Billing → Upgrade*) mantiene gratis lo que esté dentro
  de los límites Always Free y es lo que suele usarse para evitar la recuperación; no se
  puede volver atrás. Detalle en el
  [FAQ del Free Tier](https://www.oracle.com/cloud/free/faq/).
- **Si pasás a Pay As You Go**, solo se cobra lo que exceda Always Free. Para no
  pasarte:
  - Creá un **presupuesto con alerta**: ☰ → *Billing & Cost Management* → *Budgets* →
    *Create Budget*, monto **1 USD** mensual, con una alerta al **1 %** del gasto real
    (*Actual Spend*) a tu email. Si algo empieza a cobrarse, te enterás por centavos.
    [Budgets](https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/budgetsoverview.htm).
  - `create-instance.sh` se niega a crear una VM que exceda los límites gratis
    (A1: 2 OCPU / 12 GB en total; dos E2.1.Micro; 200 GB de discos en total).
  - Al crear algo a mano en la consola, buscá la etiqueta **"Always Free-eligible"**.
    No crees *Load Balancers* que no sean el flexible de 10 Mbps, ni IPs públicas
    reservadas de más, ni backups de disco por encima de 5.
  - Revisá de vez en cuando *Billing & Cost Management* → *Cost Analysis*: tiene que
    marcar 0.
- **Cuenta inactiva:** las cuentas sin uso durante 30 días pueden considerarse
  abandonadas; entrá a la consola de vez en cuando.
