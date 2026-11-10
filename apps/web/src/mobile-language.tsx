import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
export type Language='en'|'es';
const es:Record<string,string>={
  "Maintenance reports":"Reportes de mantenimiento",
  "Report a broken item or repair needed. Do not include guest names or personal details.":"Reporte daños o reparaciones necesarias. No incluya nombres de huéspedes ni datos personales.",
  "Report maintenance issue":"Reportar problema de mantenimiento",
  "Report repair":"Reportar reparación",
  "Refresh tickets":"Actualizar reportes",
  "Loading maintenance tickets…":"Cargando reportes de mantenimiento…",
  "Location":"Ubicación",
  "Choose room or area":"Seleccione habitación o área",
  "Room":"Habitación",
  "Other hotel location (describe below)":"Otra área del hotel (describa abajo)",
  "Issue type":"Tipo de problema",
  "What needs repair?":"¿Qué necesita reparación?",
  "Describe the problem and exact location.":"Describa el problema y la ubicación exacta.",
  "Priority":"Prioridad",
  "Submit repair ticket":"Enviar reporte",
  "Submitting…":"Enviando…",
  "Cancel":"Cancelar",
  "My reported tickets":"Mis reportes",
  "No repair requests submitted yet.":"Todavía no hay reportes de mantenimiento.",
  "Status":"Estado",
  "Assigned to":"Asignado a",
  "Not yet assigned":"Sin asignar",
  "Repair notes":"Notas de reparación",
  "General hotel area":"Área general del hotel",
  "Open":"Abierto",
  "Closed":"Cerrado",
  "LOW":"Baja",
  "MEDIUM":"Media",
  "HIGH":"Alta",
  "URGENT":"Urgente",
  "AC / Heating":"Aire acondicionado / calefacción",
  "Plumbing / Water":"Plomería / agua",
  "Electrical / Lights":"Electricidad / iluminación",
  "TV / Remote":"Televisión / control remoto",
  "Door / Lock":"Puerta / cerradura",
  "Furniture / Fixtures":"Muebles / accesorios",
  "Pest / Odor":"Plagas / olores",
  "Safety Concern":"Problema de seguridad",
  "Other":"Otro",
  "Maintenance request submitted. Supervisors were notified.":"Reporte enviado. Se notificó a supervisión.",
  "An open ticket exists for this room. Review your tickets before reporting a duplicate.":"Ya existe un reporte abierto para esta habitación. Revíselo antes de enviar otro.",
  "For urgent safety hazards, contact your supervisor immediately; this form is not an emergency call.":"Si hay un peligro urgente, avise de inmediato a su supervisor. Este formulario no sustituye una llamada de emergencia.",
  "Could not load maintenance tickets. Try refreshing.":"No se pudieron cargar los reportes. Intente actualizar.",
  "Unable to refresh repair tickets.":"No se pudieron actualizar los reportes.",
  
  'My Work Today':'Mi trabajo de hoy','Guest rooms':'Habitaciones','Public areas':'Áreas públicas','Completed':'Completadas','Remaining':'Pendientes','Awaiting inspection':'Pendiente de inspección','Verified':'Verificada','Cancelled':'Cancelada','Pending':'Pendiente','In progress':'En curso','Start':'Iniciar','Complete':'Completar','Instructions':'Instrucciones','No instructions.':'Sin instrucciones.','Started':'Inicio','Finished':'Finalización','Supervisor inspection':'Inspección del supervisor','Not started':'Sin iniciar','Not verified':'Sin verificar','Refresh work':'Actualizar trabajo','Loading today’s work…':'Cargando el trabajo de hoy…','No guest rooms assigned today.':'No hay habitaciones asignadas hoy.','No public areas assigned today.':'No hay áreas públicas asignadas hoy.','Cleaning checklist':'Lista de limpieza','Cleaning notes':'Notas de limpieza','Saved — completion confirmed.':'Guardado: finalización confirmada.','Saved — work started.':'Guardado: trabajo iniciado.','Change not confirmed. Refresh work before trying again.':'Cambio sin confirmar. Actualice el trabajo antes de intentarlo otra vez.','Could not refresh work. Your previous view may be out of date.':'No se pudo actualizar. Los datos anteriores pueden estar desactualizados.','Last refreshed':'Última actualización','English':'English','Spanish':'Español','Language':'Idioma','Sign in to your property':'Iniciar sesión en su hotel','Use your individual employee account.':'Use su cuenta individual de empleado.','Property code':'Código del hotel','Email':'Correo electrónico','Password':'Contraseña','Sign in':'Iniciar sesión','Signing in…':'Iniciando sesión…','Sign out':'Cerrar sesión','Connecting to Lead Connect…':'Conectando con Lead Connect…','Hotel operations, connected.':'Operaciones del hotel, conectadas.','Need access or forgot your password?':'¿Necesita acceso u olvidó su contraseña?','Ask your manager to verify your identity and provide a private, one-time code. Never share a password.':'Pida a su gerente que verifique su identidad y le entregue un código privado de un solo uso. Nunca comparta una contraseña.','Activation or recovery code':'Código de activación o recuperación','New password':'Nueva contraseña','Confirm password':'Confirmar contraseña','Set private password':'Establecer contraseña privada','Passwords must match and contain 12–128 characters.':'Las contraseñas deben coincidir y tener de 12 a 128 caracteres.','Password set. Sign in with your individual account.':'Contraseña establecida. Inicie sesión con su cuenta individual.','Code could not be redeemed. Ask your manager for a fresh code.':'No se pudo usar el código. Pida uno nuevo a su gerente.','Sign-in failed. Check your hotel, email and password, or contact your manager.':'No se pudo iniciar sesión. Revise el hotel, correo y contraseña, o contacte a su gerente.','Housekeeping':'Limpieza','Public Areas':'Áreas públicas','Dashboard':'Panel','Rooms':'Habitaciones','Maintenance':'Mantenimiento','Notifications':'Notificaciones','Account':'Cuenta','Slot':'Turno','Unknown':'Sin confirmar','Hotel remembered on this device. No password is stored here.':'Se recuerda el hotel en este dispositivo. No se guarda la contraseña aquí.','Work status':'Estado del trabajo','Save checklist progress':'Guardar progreso de la lista','Saved — checklist updated.':'Guardado: lista actualizada.','Contact your manager to change assignments or request inspection.':'Contacte a su gerente para cambiar asignaciones o solicitar inspección.'
};
const Context=createContext({language:'en' as Language,setLanguage:(_value:Language)=>{},t:(key:string)=>key});
export function LanguageProvider({children}:{children:ReactNode}){
  const [language,setLanguage]=useState<Language>(()=>{try{return localStorage.getItem('lead-connect-language')==='es'?'es':'en';}catch{return 'en';}});
  useEffect(()=>{document.documentElement.lang=language;try{localStorage.setItem('lead-connect-language',language);}catch{}},[language]);
  return <Context.Provider value={{language,setLanguage,t:(key)=>language==='es'?(es[key]??key):key}}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
export function LanguageSelect(){const {language,setLanguage,t}=useLanguage();return <label className="control language-select">{t('Language')}<select aria-label={t('Language')} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="en">English</option><option value="es">Español</option></select></label>;}
export function rememberedHotel(){try{return localStorage.getItem('lead-connect-hotel')?.slice(0,64)??'';}catch{return '';}}
export function rememberHotel(code:string){try{localStorage.setItem('lead-connect-hotel',code.trim().slice(0,64));}catch{}}
