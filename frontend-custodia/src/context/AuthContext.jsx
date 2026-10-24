import {createContext,useEffect,useRef,useState} from 'react';
import api from '../services/api';
export const AuthContext=createContext();

export function AuthProvider({children}){
  const[usuario,setUsuario]=useState(null);const[cargando,setCargando]=useState(true);const timerRef=useRef(null);
  const logout=(motivo='')=>{localStorage.removeItem('token');localStorage.removeItem('usuario');if(motivo)localStorage.setItem('logout_reason',motivo);setUsuario(null);};
  const reiniciarInactividad=()=>{clearTimeout(timerRef.current);if(localStorage.getItem('token')){const mins=Number(import.meta.env.VITE_SESSION_IDLE_MINUTES||15);timerRef.current=setTimeout(()=>logout(`Sesión cerrada por ${mins} minutos de inactividad.`),mins*60*1000);}};
  useEffect(()=>{let mounted=true;(async()=>{const token=localStorage.getItem('token');if(token){try{const{data}=await api.get('/auth/me');if(mounted){localStorage.setItem('usuario',JSON.stringify(data));setUsuario(data);}}catch{localStorage.removeItem('token');localStorage.removeItem('usuario');}}if(mounted)setCargando(false);})();return()=>{mounted=false;};},[]);
  useEffect(()=>{if(!usuario)return;const events=['mousemove','mousedown','keydown','touchstart','scroll'];events.forEach(e=>window.addEventListener(e,reiniciarInactividad,{passive:true}));reiniciarInactividad();return()=>{events.forEach(e=>window.removeEventListener(e,reiniciarInactividad));clearTimeout(timerRef.current);};},[usuario]);
  const login=async(correo,password)=>{try{const{data}=await api.post('/auth/login',{correo,password});localStorage.setItem('token',data.token);localStorage.setItem('usuario',JSON.stringify(data.usuario));localStorage.removeItem('logout_reason');setUsuario(data.usuario);return{success:true};}catch(e){return{success:false,mensaje:e.response?.data?.mensaje||'Error al conectar con el servidor'};}};
  const refrescarPerfil=async()=>{const{data}=await api.get('/auth/me');localStorage.setItem('usuario',JSON.stringify(data));setUsuario(data);return data;};
  const tienePermiso=(modulo,accion)=>Boolean(usuario&&(usuario.permisos||[]).some(p=>p.modulo?.toLowerCase()===modulo.toLowerCase()&&p.accion?.toLowerCase()===accion.toLowerCase()));
  return <AuthContext.Provider value={{usuario,login,logout,cargando,refrescarPerfil,tienePermiso}}>{children}</AuthContext.Provider>;
}
