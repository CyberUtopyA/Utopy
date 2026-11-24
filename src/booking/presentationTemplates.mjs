/** Declarative presentation only. No identity, customers, schedules or authority. */
export const BOOKING_PRESENTATION_TEMPLATES = Object.freeze({
 'bassi-editorial-salon': Object.freeze({
  id:'bassi-editorial-salon', label:'Salón editorial', capability:'living-booking',
  categories:['Femenino','Masculino','Cortes','Barbería','Coloración','Skincare','Cejas','Makeup'],
  tokens:{background:'#151925',ink:'#fff7e9',accent:'#e2b467'},
  heroCaption:'Femenino · Masculino', bookingLabel:'Reservar cita', reservationTitle:'Agendar cita',
  heroTitle:'welcome', welcomeTitle:'Bienvenido', reservationIntro:'Elegí tu servicio, fecha, horario y profesional.',
  navigation:[['home','Inicio'],['services','Servicios'],['appointments','Citas'],['account','Mi cuenta']],
  categoryIcons:{Femenino:'person',Masculino:'person',Cortes:'scissors',Barbería:'scissors',Coloración:'brush',Skincare:'droplets',Cejas:'eye',Makeup:'brush'},
 }),
});
export const bookingPresentationTemplate=id=>BOOKING_PRESENTATION_TEMPLATES[id]||null;
