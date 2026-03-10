"use client";
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
// Coordinate system: 720x380 viewBox
const P = {
    spendKey: {
        x: 40,
        y: 20,
        w: 140,
        h: 52,
    },
    viewKey: {
        x: 200,
        y: 20,
        w: 140,
        h: 52,
    },
    sender: {
        x: 560,
        y: 20,
        w: 120,
        h: 52,
    },
    step1: {
        y: 110,
    },
    step2: {
        y: 200,
    },
    step3: {
        y: 290,
    },
    badge: {
        x: 40,
        w: 28,
        h: 28,
    },
    curveViz: {
        x: 520,
        y: 100,
        w: 160,
        h: 60,
    },
    secret: {
        x: 520,
        y: 195,
        w: 160,
        h: 40,
    },
    stealth: {
        x: 500,
        y: 275,
        w: 200,
        h: 50,
    },
}
const VW = 720
const VH = 380
const pctX = (v: number) => `${(v / VW) * 100}%`
const pctY = (v: number) => `${(v / VH) * 100}%`
export function ECDHKeyDerivation() {
    const [step, setStep] = useState(0)
    const cancelled = useRef(false)
    const runLoop = useCallback(async () => {
        while (!cancelled.current) {
            setStep(0)
            await delay(600)
            setStep(1)
            await delay(2000)
            setStep(2)
            await delay(2000)
            setStep(3)
            await delay(2500)
            setStep(0)
            await delay(1000)
        }
    }, [])
    useEffect(() => {
        cancelled.current = false
        runLoop()
        return () => {
            cancelled.current = true
        }
    }, [runLoop])
    return (
        <div className="w-full relative border border-dust-border bg-[rgba(255,255,255,0.01)] p-4 sm:p-8 flex flex-col font-mono">
            <div className="text-[10px] text-dust-muted uppercase tracking-[0.2em] mb-4">
                STEALTH TRANSFERS / ECDH DERIVATION
            </div>

            <div className="w-full overflow-x-auto">
            <div
                className="relative"
                style={{
                    aspectRatio: '720 / 380',
                    minWidth: 480,
                }}
            >
                {/* SVG LAYER */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 720 380"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <filter id="ecdhGlow">
                            <feGaussianBlur stdDeviation="5" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        <marker
                            id="ecdhArrow"
                            markerWidth="8"
                            markerHeight="6"
                            refX="7"
                            refY="3"
                            orient="auto"
                        >
                            <path
                                d="M0,0.5 L7,3 L0,5.5"
                                fill="none"
                                stroke="rgba(0,255,65,0.4)"
                                strokeWidth="0.8"
                            />
                        </marker>
                        <marker
                            id="ecdhArrowAmber"
                            markerWidth="8"
                            markerHeight="6"
                            refX="7"
                            refY="3"
                            orient="auto"
                        >
                            <path
                                d="M0,0.5 L7,3 L0,5.5"
                                fill="none"
                                stroke="#FFB000"
                                strokeWidth="0.8"
                            />
                        </marker>
                    </defs>

                    {/* Meta-address bracket under keys */}
                    <line
                        x1={P.spendKey.x}
                        y1={P.spendKey.y + P.spendKey.h + 8}
                        x2={P.viewKey.x + P.viewKey.w}
                        y2={P.viewKey.y + P.viewKey.h + 8}
                        stroke="rgba(255,255,255,0.1)"
                    />
                    <text
                        x={(P.spendKey.x + P.viewKey.x + P.viewKey.w) / 2}
                        y={P.spendKey.y + P.spendKey.h + 24}
                        fill="rgba(255,255,255,0.3)"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="JetBrains Mono"
                    >
                        alice.dust meta-address
                    </text>

                    {/* Step connector lines (vertical, left side along badges) */}
                    <line
                        x1={P.badge.x + P.badge.w / 2}
                        y1={P.step1.y + P.badge.h + 4}
                        x2={P.badge.x + P.badge.w / 2}
                        y2={P.step2.y}
                        stroke={
                            step >= 2 ? 'rgba(0,255,65,0.25)' : 'rgba(255,255,255,0.06)'
                        }
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        className="transition-all duration-500"
                    />
                    <line
                        x1={P.badge.x + P.badge.w / 2}
                        y1={P.step2.y + P.badge.h + 4}
                        x2={P.badge.x + P.badge.w / 2}
                        y2={P.step3.y}
                        stroke={
                            step >= 3 ? 'rgba(0,255,65,0.25)' : 'rgba(255,255,255,0.06)'
                        }
                        strokeWidth="1"
                        strokeDasharray="3 3"
                        className="transition-all duration-500"
                    />

                    {/* Arrow: Sender → curve area (step 1) */}
                    {step >= 1 && (
                        <motion.line
                            initial={{
                                opacity: 0,
                                pathLength: 0,
                            }}
                            animate={{
                                opacity: 0.5,
                                pathLength: 1,
                            }}
                            transition={{ duration: 0.5 }}
                            x1={P.sender.x + P.sender.w / 2}
                            y1={P.sender.y + P.sender.h}
                            x2={P.curveViz.x + P.curveViz.w / 2}
                            y2={P.curveViz.y}
                            stroke="#00FF41"
                            strokeWidth="1"
                            strokeDasharray="4 3"
                            markerEnd="url(#ecdhArrow)"
                        />
                    )}

                    {/* Arrow: Curve → Shared Secret (step 2) */}
                    {step >= 2 && (
                        <motion.line
                            initial={{
                                opacity: 0,
                                pathLength: 0,
                            }}
                            animate={{
                                opacity: 0.5,
                                pathLength: 1,
                            }}
                            transition={{ duration: 0.5 }}
                            x1={P.curveViz.x + P.curveViz.w / 2}
                            y1={P.curveViz.y + P.curveViz.h}
                            x2={P.secret.x + P.secret.w / 2}
                            y2={P.secret.y}
                            stroke="#FFB000"
                            strokeWidth="1"
                            strokeDasharray="4 3"
                            markerEnd="url(#ecdhArrowAmber)"
                        />
                    )}

                    {/* Arrow: Shared Secret → Stealth Address (step 3) */}
                    {step >= 3 && (
                        <motion.line
                            initial={{
                                opacity: 0,
                                pathLength: 0,
                            }}
                            animate={{
                                opacity: 0.5,
                                pathLength: 1,
                            }}
                            transition={{ duration: 0.5 }}
                            x1={P.secret.x + P.secret.w / 2}
                            y1={P.secret.y + P.secret.h}
                            x2={P.stealth.x + P.stealth.w / 2}
                            y2={P.stealth.y}
                            stroke="#00FF41"
                            strokeWidth="1"
                            strokeDasharray="4 3"
                            markerEnd="url(#ecdhArrow)"
                        />
                    )}

                    {/* Elliptic curve visualization */}
                    <path
                        d={`M ${P.curveViz.x + 10} ${P.curveViz.y + 45} Q ${P.curveViz.x + P.curveViz.w / 2} ${P.curveViz.y + 5} ${P.curveViz.x + P.curveViz.w - 10} ${P.curveViz.y + 45}`}
                        fill="none"
                        stroke="#00FF41"
                        strokeOpacity="0.2"
                        strokeWidth="1"
                    />
                    {/* G point */}
                    <circle
                        cx={P.curveViz.x + 30}
                        cy={P.curveViz.y + 40}
                        r="3"
                        fill="#00FF41"
                        fillOpacity="0.6"
                    />
                    <text
                        x={P.curveViz.x + 22}
                        y={P.curveViz.y + 56}
                        fill="#00FF41"
                        fontSize="8"
                        fontFamily="JetBrains Mono"
                    >
                        G
                    </text>
                    {/* R point */}
                    <circle
                        cx={P.curveViz.x + P.curveViz.w - 30}
                        cy={P.curveViz.y + 40}
                        r="3"
                        fill={step >= 1 ? "#00FF41" : "rgba(0,255,65,0.2)"}
                        fillOpacity={step >= 1 ? "0.8" : "0.3"}
                    >
                        {step >= 1 && (
                            <animate
                                attributeName="r"
                                values="3;6;3"
                                dur="1.5s"
                                repeatCount="indefinite"
                            />
                        )}
                        {step >= 1 && (
                            <animate
                                attributeName="fill-opacity"
                                values="0.6;1;0.6"
                                dur="1.5s"
                                repeatCount="indefinite"
                            />
                        )}
                    </circle>
                    <text
                        x={P.curveViz.x + P.curveViz.w - 45}
                        y={P.curveViz.y + 56}
                        fill="#00FF41"
                        fontSize="8"
                        fontFamily="JetBrains Mono"
                    >
                        R = r×G
                    </text>
                </svg>

                {/* HTML LAYER */}

                {/* Spend Key */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(P.spendKey.x),
                        top: pctY(P.spendKey.y),
                        width: pctX(P.spendKey.w),
                        height: pctY(P.spendKey.h),
                    }}
                >
                    <div className="w-full h-full border border-dust-border bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center">
                        <span className="text-[8px] text-dust-muted">PUBLIC</span>
                        <span className="text-[10px] font-bold">SPEND KEY</span>
                    </div>
                </div>

                {/* View Key */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(P.viewKey.x),
                        top: pctY(P.viewKey.y),
                        width: pctX(P.viewKey.w),
                        height: pctY(P.viewKey.h),
                    }}
                >
                    <div className="w-full h-full border border-dust-border bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center">
                        <span className="text-[8px] text-dust-muted">PUBLIC</span>
                        <span className="text-[10px] font-bold">VIEW KEY</span>
                    </div>
                </div>

                {/* Sender */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(P.sender.x),
                        top: pctY(P.sender.y),
                        width: pctX(P.sender.w),
                        height: pctY(P.sender.h),
                    }}
                >
                    <div
                        className={`w-full h-full border ${step === 1 ? 'border-[rgba(0,255,65,0.3)] shadow-glow-green' : 'border-dust-border'} bg-[rgba(255,255,255,0.02)] flex items-center justify-center transition-all duration-300`}
                    >
                        <span className="text-[10px] font-bold">SENDER</span>
                    </div>
                </div>

                {/* Step 01 */}
                <div
                    className="absolute flex items-center gap-4"
                    style={{
                        left: pctX(P.badge.x),
                        top: pctY(P.step1.y),
                        width: pctX(450),
                    }}
                >
                    <div
                        className={`w-7 h-7 flex items-center justify-center border ${step >= 1 ? 'border-dust-green/50 bg-dust-green/15' : 'border-dust-green/20 bg-dust-green/5'} text-[10px] text-dust-green font-bold transition-all duration-300`}
                    >
                        01
                    </div>
                    <div
                        style={{
                            opacity: step >= 1 ? 1 : 0.15,
                        }}
                        className="transition-opacity duration-500"
                    >
                        <div className="text-[10px] text-white">
                            Sender picks random scalar{' '}
                            <span className="text-dust-green">r</span>, computes{' '}
                            <span className="text-dust-green">R = r × G</span>
                        </div>
                        <div className="text-[9px] text-dust-muted mt-0.5">
                            Ephemeral keypair on secp256k1
                        </div>
                    </div>
                </div>

                {/* Step 02 */}
                <div
                    className="absolute flex items-center gap-4"
                    style={{
                        left: pctX(P.badge.x),
                        top: pctY(P.step2.y),
                        width: pctX(450),
                    }}
                >
                    <div
                        className={`w-7 h-7 flex items-center justify-center border ${step >= 2 ? 'border-dust-green/50 bg-dust-green/15' : 'border-dust-green/20 bg-dust-green/5'} text-[10px] text-dust-green font-bold transition-all duration-300`}
                    >
                        02
                    </div>
                    <div
                        style={{
                            opacity: step >= 2 ? 1 : 0.15,
                        }}
                        className="transition-opacity duration-500"
                    >
                        <div className="text-[10px] text-white">Compute shared secret</div>
                        <div className="text-[9px] text-dust-muted mt-0.5">
                            sharedSecret = r × viewKey
                        </div>
                    </div>
                </div>

                {/* Shared Secret Box */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(P.secret.x),
                        top: pctY(P.secret.y),
                        width: pctX(P.secret.w),
                        height: pctY(P.secret.h),
                    }}
                >
                    <div
                        className={`w-full h-full border ${step >= 2 ? 'border-dust-amber bg-dust-amber/5' : 'border-transparent'} flex items-center justify-center transition-all duration-500`}
                    >
                        <span
                            className={`text-[10px] ${step >= 2 ? 'text-dust-amber' : 'text-transparent'} transition-all duration-500`}
                        >
                            SHARED SECRET
                        </span>
                    </div>
                </div>

                {/* Step 03 */}
                <div
                    className="absolute flex items-center gap-4"
                    style={{
                        left: pctX(P.badge.x),
                        top: pctY(P.step3.y),
                        width: pctX(450),
                    }}
                >
                    <div
                        className={`w-7 h-7 flex items-center justify-center border ${step >= 3 ? 'border-dust-green/50 bg-dust-green/15' : 'border-dust-green/20 bg-dust-green/5'} text-[10px] text-dust-green font-bold transition-all duration-300`}
                    >
                        03
                    </div>
                    <div
                        style={{
                            opacity: step >= 3 ? 1 : 0.15,
                        }}
                        className="transition-opacity duration-500"
                    >
                        <div className="text-[10px] text-white">Derive stealth address</div>
                        <div className="text-[9px] text-dust-muted mt-0.5">
                            addr = spendKey + hash(sharedSecret) × G
                        </div>
                    </div>
                </div>

                {/* Stealth Address Box */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(P.stealth.x),
                        top: pctY(P.stealth.y),
                        width: pctX(P.stealth.w),
                        height: pctY(P.stealth.h),
                    }}
                >
                    <motion.div
                        animate={
                            step === 3
                                ? {
                                    boxShadow: [
                                        '0 0 0px rgba(0,255,65,0)',
                                        '0 0 20px rgba(0,255,65,0.3)',
                                        '0 0 8px rgba(0,255,65,0.1)',
                                    ],
                                }
                                : {
                                    boxShadow: '0 0 0px rgba(0,255,65,0)',
                                }
                        }
                        transition={{
                            duration: 1.2,
                        }}
                        className={`w-full h-full border ${step >= 3 ? 'border-dust-green' : 'border-transparent'} bg-[#06080F] flex flex-col items-center justify-center transition-all duration-500`}
                    >
                        <span
                            className={`text-[11px] font-bold ${step >= 3 ? 'text-white' : 'text-transparent'} transition-all duration-500`}
                        >
                            STEALTH ADDRESS
                        </span>
                        <span
                            className={`text-[8px] mt-0.5 ${step >= 3 ? 'text-dust-green' : 'text-transparent'} transition-all duration-500`}
                        >
                            unique · one-time · unlinkable
                        </span>
                    </motion.div>
                </div>
            </div>
            </div>
        </div>
    )
}
function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}
