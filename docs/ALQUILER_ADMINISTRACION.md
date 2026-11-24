# Administración de alquileres

La ficha muestra Crear contrato y Pausar disponibilidad / Marcar disponible sólo si la identidad activa es el propietario o un administrador autorizado en el perfil firmado del propietario. La comprobación se repite en las acciones; cambiar de identidad vuelve a comprobar permisos. La disponibilidad exige además una propiedad firmada por ese propietario y no permite liberar contratos ni reservas activas.

Los perfiles importados de Skylines conservan identificadores históricos de propietario. Esos identificadores no acreditan una vinculación con la identidad del usuario actual. No se concede administración al primer visitante, al autor de una importación, por nombre, por documento ni desde localStorage.

Para administrar se necesita recuperar la identidad propietaria ya vinculada o recibir una autorización firmada del propietario. La pantalla para vincular con garantías de origen estos propietarios históricos a sus identidades reales sigue pendiente; no se ha ejecutado ninguna vinculación ni asignado al usuario permisos desde esta tarea. No presentar estos cambios como un alta administrativa completa.

Pruebas de dominio, contratos y build ejecutadas. Pendiente comprobar sesión propietaria real, transporte entre dispositivos y persistencia con autorización efectiva en producción.
