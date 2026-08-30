import { NextResponse } from "next/server";import { cookieName } from "@/lib/auth/server";
export async function POST(){const res=NextResponse.redirect(new URL("/",process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000"),303);res.cookies.set(cookieName,"",{httpOnly:true,path:"/",maxAge:0});return res;}
