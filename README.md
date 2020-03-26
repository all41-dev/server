# @all41/server
Base server that hosts express related apis & uis, sequelize databases and scheduled jobs.

## v1.2.1 notice
The following environment vars support has been removed, replaced by related parameters:

**Db**
 | env var | parameter | param type | default |
 | --- | --- | --- | --- |
 | SQLITE_STORAGE_PATH | sqliteStoragePath | string? | |
 | SQL_ENGINE | sqlEngine | 'mysql' \| 'postgres' \| 'mssql' \| 'sqlite' \| 'mariadb'\|undefined | 'mysql' |
 | SQL_HOSTNAME | hostname | string? | 'localhost' |
 | DEFAULT_DB_LOGGING | logging | boolean | false |
 | SQL_PORT | port | number? | mssql:1433 postgress:5432 sqlite:undefined mariadb:3306 mysql:3306 |
 | GOOGLE_CLOUD_SQL_CONNECTION_NAME | proxy | string? | undefined |
 | MYSQL_DECIMAL_NUMBERS | mysqlDecimalNumbers | boolean? | false |

**Server (IServerOptions)**
 | env var | parameter | param type | default |
 | --- | --- | --- | --- |
 | CONSOLE_LOG_LEVEL | consoleLogLevel | 'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal' | 'debug' |
 | HTTP_PORT | port | number? | 8080 |
 | SKIP_JOBS | skipJobs (start function param) | boolean? | false |