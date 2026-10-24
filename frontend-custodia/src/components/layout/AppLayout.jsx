import {NavLink,Outlet} from 'react-router-dom';import {useContext} from 'react';import {AuthContext} from '../../context/AuthContext';import {Activity,AlertTriangle,Archive,ClipboardCheck,FileSearch,FileText,LogOut,Settings,ShieldCheck,ScrollText} from 'lucide-react';
const items=[
{to:'/',label:'Inicio',icon:Activity},
{to:'/incidentes',label:'Incidentes',icon:FileText,p:['Incidentes','ver']},
{to:'/evidencias',label:'Evidencias',icon:Archive,p:['Evidencias','ver']},
{to:'/custodia',label:'Custodia',icon:ShieldCheck,p:['Custodia','ver']},
{to:'/solicitudes',label:'Solicitudes',icon:ClipboardCheck,p:['Solicitudes','ver']},
{to:'/analisis',label:'Análisis',icon:FileSearch,p:['Analisis','ver']},
{to:'/alertas',label:'Alertas',icon:AlertTriangle,p:['Alertas','ver']},
{to:'/auditoria',label:'Auditoría',icon:ScrollText,p:['Auditoria','ver']},
{to:'/administracion',label:'Administración',icon:Settings,p:['Usuarios','ver']},
];
export function AppLayout(){const{usuario,logout,tienePermiso}=useContext(AuthContext);const visibles=items.filter(i=>!i.p||tienePermiso(...i.p));return <div className="min-h-screen bg-liquid-abyss text-platinum"><div className="fixed inset-y-0 left-0 w-64 bg-liquid-deep border-r border-white/10 hidden lg:flex flex-col z-40"><div className="p-7 border-b border-white/10"><div className="font-semibold tracking-[.18em]">CUSTODIA</div><div className="text-xs text-silver-mist mt-1">Control Forense</div></div><nav className="p-3 flex-1 overflow-y-auto">{visibles.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/'} className={({isActive})=>`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 text-sm ${isActive?'bg-liquid-kelp text-white':'text-silver-mist hover:bg-white/5 hover:text-white'}`}><Icon size={17}/>{label}</NavLink>)}</nav><div className="p-4 border-t border-white/10"><div className="text-sm font-medium">{usuario?.nombre} {usuario?.apellido}</div><div className="text-xs text-silver-mist">{usuario?.rol_nombre}</div>{usuario?.area&&<div className="text-xs text-silver-mist mb-3">Área: {usuario.area}</div>}<button onClick={()=>logout()} className="w-full flex items-center gap-2 text-sm text-silver-mist hover:text-white mt-3"><LogOut size={16}/>Cerrar sesión</button></div></div><div className="lg:ml-64"><header className="lg:hidden p-4 border-b border-white/10 flex justify-between"><strong>CUSTODIA</strong><button onClick={()=>logout()}><LogOut size={18}/></button></header><main className="p-5 md:p-8 max-w-[1500px] mx-auto"><Outlet/></main></div></div>;}
