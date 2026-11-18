import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { LockIcon, MailIcon, UserIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';

const Login = ({mode = "login"}) => {

    const isRegister = mode === "register";
    const navigate = useNavigate()
    const {login, register} = useApp()

    const [form, setForm] = useState({name: "", email: "", password: ""})
    const [isLoading, setIsLoading] = useState(false)
    const [loginError, setLoginError] = useState('')
    const [registerError, setRegisterError] = useState('')

    const updateField = (key, value)=> setForm((prev)=> ({...prev, [key]: value}));

    const handleSubmit = async (e)=>{
        e.preventDefault();
        setIsLoading(true)
        const result = isRegister ? await register(form.name, form.email, form.password) : await login(form.email, form.password);
        setIsLoading(false)
        if(result.success) navigate("/")
        else if(isRegister) setRegisterError(result.error)
        else setLoginError(result.error)
    }

    // Clear login error when user starts typing    const clearLoginError = () => setLoginError('')
    const clearRegisterError = () => setRegisterError('')

  return (
    <div className="min-h-screen text-zinc-900 flex flex-col md:flex-row">
        {/* Left Hero Brand Panel */}
        <div className="md:w-1/2 p-8 md:p-12 lg:p-16 bg-linear-to-br from-orange-50 via-zinc-100 to-red-50 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col justify-between relative overflow-hidden">
        <div className='absolute inset-0 bg-[url("/pattern.svg")]'></div>
        <div className="relative z-10 flex items-center gap-3">
            <img src="/logo.svg" alt="Cloud-Nest Logo" className="max-h-9"/>
            <span className='text-4xl font-medium uppercase text-zinc-900'>Cloud-Nest</span>
        </div>

        <div className="relative z-10 my-12 space-y-6">
            <h2 className='text-3xl md:text-4xl lg:text-5xl tracking-tight text-zinc-900 leading-tight'>Secure, Simple & Fast <br /> <span className='text-orange-600'>Cloud Storage.</span></h2>
            <p className='text-sm md:text-base text-zinc-600 max-w-md leading-relaxed'>
               Store your files securely in our drive, organize into folders, share with permissions and access anywhere.  
            </p>
        </div>

        <div className='relative z-10 text-sm text-zinc-500'>© 2026 Cloud-Nest. All rights reserved.</div>
        </div>

        {/* Right Auth Form */}
        <div className="md:w-1/2 p-8 md:p-12 lg:p-16 flex items-center justify-center bg-white">
             <div className="w-full max-w-md space-y-6 animate-fade-in">
                <div>
                    <h3 className='text-2xl font-medium text-zinc-900'>{isRegister ? "Create an account" : "Welcome back"}</h3>
                    <p className='text-sm text-zinc-500 mt-1'>
                        {isRegister 
                        ? "Enter your details below to get started with 1 GB free storage"
                        : "Enter your credentials to access your Drive"}
                    </p>
                </div>

                {/* Floating Login Error Toasts (3 pills stacked) - overlaps column boundary */}
                {isRegister ? null : (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-max space-y-1">
                        {loginError && (
                            <div className="flex items-center gap-2">
                                {loginError.split('\n').map((error, index) => (
                                    <div key={index} className="flex items-center gap-2 rounded-full bg-white p-2 shadow-sm border border-red-200/50">
                                        <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>
                                        <span>{error}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className='space-y-4'>
                    {isRegister && (
                        <Input 
                        label="Full Name"
                        icon={UserIcon}
                        placeholder="John Doe"
                        value={form.name}
                        onChange={(e)=>updateField("name", e.target.value)}
                        required
                        />
                    )}

                    <Input 
                        label="Email Address"
                        type='email'
                        icon={MailIcon}
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e)=>updateField("email", e.target.value)}
                        required
                        />

                    <Input 
                        label="Password"
                        type='password'
                        icon={LockIcon}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e)=>updateField("password", e.target.value)}
                        required
                        />

                    <Button type='submit' variant="primary" className="w-full py-3" isLoading={isLoading}>
                        <span className="font-medium text-base">
                            {isRegister ? "Register Account" : "Sign In"}
                        </span>
                    </Button>

                </form>

                {/* Inline Error Pill Below Sign In Button */}
                {isRegister && registerError ? (
                    <div className="flex items-center justify-center gap-2 text-sm mt-2">
                        <div className="flex items-center gap-2 rounded-full bg-white p-2 shadow-sm border border-red-200/50">
                            <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>
                            <span>{registerError}</span>
                        </div>
                    </div>
                ) : null}

                <div className="text-center pt-2">
                    {isRegister ? (
                        <p className='text-xs text-zinc-500'>Already have an account? {" "}
                        <Link to="/login" className="text-orange-600 font-semibold hover:underline">
                            Sign in here
                        </Link>
                        </p>
                    ) : (
                        <p className='text-xs text-zinc-500'>Don't have an account yet? {" "}
                        <Link to="/register" className="text-orange-600 font-semibold hover:underline">
                            Create account
                        </Link>
                        </p>
                    )}

                </div>
            </div>
        </div>
    </div>
  )
}

export default Login