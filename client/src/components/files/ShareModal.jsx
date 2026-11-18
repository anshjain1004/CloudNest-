import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { CheckIcon, CopyIcon, Loader2Icon, MailIcon, SendIcon, XIcon } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import api from '../../config/api'
import toast from 'react-hot-toast'

const resourceTypeOf = (item) => (item?.item_type === "folder" ? "folder" : "file")

const ShareModal = ({item, isOpen, onClose}) => {
    const [tab, setTab] = useState("link")
    const [copied, setCopied] = useState(false)
    const [generatedLink, setGeneratedLink] = useState("")
    const [shareLinkId, setShareLinkId] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    // Direct (user-to-user) sharing state
    const [email, setEmail] = useState("")
    const [permission, setPermission] = useState("download")
    const [isSending, setIsSending] = useState(false)
    const [people, setPeople] = useState([])
    const [isPeopleLoading, setIsPeopleLoading] = useState(false)

    const getOrCreateShareLink = useCallback(async () => {
        if(!item) return;

        setIsLoading(true)
        try {
            const { data } = await api.post("/api/shares", {
                resource_type: resourceTypeOf(item),
                resource_id: item.id,
                permission: "download",
            })

            const link = data.share_link;
            if(link?.token){
                const fullUrl = `${window.location.origin}/s/${link.token}`;
                setGeneratedLink(fullUrl)
                setShareLinkId(link.id)
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Error generating share link.");
        }finally{
            setIsLoading(false)
        }
    },[item])

    const fetchPeople = useCallback(async () => {
        if(!item) return;
        setIsPeopleLoading(true)
        try {
            const { data } = await api.get("/api/shares/direct", {
                params: { resource_type: resourceTypeOf(item), resource_id: item.id },
            })
            setPeople(data.direct_shares || [])
        } catch (err) {
            toast.error(err.response?.data?.error || "Error loading shared people.");
        } finally {
            setIsPeopleLoading(false)
        }
    },[item])

    useEffect(()=>{
        if (isOpen && item) {
            setCopied(false)
            setGeneratedLink("")
            setShareLinkId(null)
            setTab("link")
            setEmail("")
            setPermission("download")
            getOrCreateShareLink()
            fetchPeople()
        }
    },[isOpen, item, getOrCreateShareLink, fetchPeople])

    const copyToClipboard = async ()=>{
        if(!generatedLink) return;

        try {
            await navigator.clipboard.writeText(generatedLink)
            setCopied(true)
            toast.success("Link copied to clipboard!")
            setTimeout(()=> setCopied(false), 2000)
        } catch {
            toast.error("Could not copy the link. Copy it manually.")
        }
    }

    const handleDeleteShareLink = async () => {
        if(!shareLinkId) return;
        try {
            await api.delete(`/api/shares/${shareLinkId}`)
            toast.success("Share link deleted.")
            setGeneratedLink("")
            setShareLinkId(null)
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || "Error deleting share link.");
        }
    }

    const handleSendToUser = async (e) => {
        e.preventDefault()
        if(!item || !email.trim()) return;

        setIsSending(true)
        try {
            const { data } = await api.post("/api/shares/direct", {
                resource_type: resourceTypeOf(item),
                resource_id: item.id,
                email: email.trim(),
                permission,
            })
            toast.success(`Shared with ${data.recipient?.name || email.trim()}`)
            setEmail("")
            fetchPeople()
        } catch (err) {
            toast.error(err.response?.data?.error || "Error sharing with this user.");
        } finally {
            setIsSending(false)
        }
    }

    const handleRevokePerson = async (shareId) => {
        try {
            await api.delete(`/api/shares/direct/${shareId}`)
            toast.success("Access revoked.")
            setPeople((prev)=> prev.filter((p)=> p.id !== shareId))
        } catch (err) {
            toast.error(err.response?.data?.error || "Error revoking access.");
        }
    }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${item?.name}"`}>
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                    type="button"
                    onClick={()=> setTab("link")}
                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition ${
                        tab === "link" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Share link
                </button>
                <button
                    type="button"
                    onClick={()=> setTab("people")}
                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition ${
                        tab === "people" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Send to user
                </button>
            </div>

            {tab === "link" ? (
                <>
                    {/* Access Level Badge */}
                    <div className='flex items-center gap-3 p-3 rounded-xl bg-orange-50/60'>
                        <div>
                        <p className="text-xs font-medium text-slate-800">Anyone with this link</p>
                         <p className="text-[11px] text-slate-500">
                            Can view and download this {item?.item_type === "folder" ? "folder" : "file"}
                        </p>
                        </div>
                    </div>

                    {/* Generated Link Box */}
                    {isLoading ? (
                        <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500">
                            <Loader2Icon className="size-5 animate-spin text-orange-600" />
                            <span className="text-xs font-medium">Generating share link...</span>
                        </div>
                    ) : generatedLink ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                            <label className='block text-xs font-medium text-slate-700'>Shareable Link</label>
                            <div className="flex items-center gap-2">
                                <Input value={generatedLink} readOnly className="bg-slate-50 text-xs text-slate-700 select-all"/>
                                <Button variant="primary" className="shrink-0" onClick={copyToClipboard}>
                                    {copied ? (
                                        <>
                                        <CheckIcon className="size-4"/>
                                        <span>Copied</span>
                                        </>
                                    ) : (
                                        <>
                                        <CopyIcon className="size-4"/>
                                        <span>Copy Link</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                            </div>

                            {/* Delete Share Link Option */}
                            <div className="pt-2 border-t border-slate-100 text-slate-500 flex items-center justify-end gap-2">
                                <span className='text-xs'>Want to revoke access?</span>
                                <button type="button"
                                    onClick={handleDeleteShareLink}
                                    aria-label="Revoke share link"
                                    className="p-1 hover:text-red-600" >
                                  <XIcon className="size-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className='py-4 text-center'>
                            <Button variant='primary' onClick={getOrCreateShareLink} isLoading={isLoading}>
                                 Generate Share Link
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* Share directly with a registered user */}
                    <form onSubmit={handleSendToUser} className="space-y-3">
                        <Input
                            label="Recipient email"
                            icon={MailIcon}
                            type="email"
                            required
                            placeholder="teammate@example.com"
                            value={email}
                            onChange={(e)=> setEmail(e.target.value)}
                        />

                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">Permission</label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={()=> setPermission("view")}
                                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition ${
                                        permission === "view"
                                            ? "border-orange-500 bg-orange-50 text-orange-700"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    Can view
                                </button>
                                <button
                                    type="button"
                                    onClick={()=> setPermission("download")}
                                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition ${
                                        permission === "download"
                                            ? "border-orange-500 bg-orange-50 text-orange-700"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    Can download
                                </button>
                            </div>
                        </div>

                        <Button type="submit" variant="primary" className="w-full" isLoading={isSending} icon={SendIcon}>
                            Send to user
                        </Button>
                        <p className="text-[11px] text-slate-500 text-center">
                            The person must already have an account. They will see it under "Shared with Me".
                        </p>
                    </form>

                    {/* People with access */}
                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-700 mb-2">People with access</p>
                        {isPeopleLoading ? (
                            <div className="py-4 flex justify-center">
                                <Loader2Icon className="size-4 animate-spin text-orange-600" />
                            </div>
                        ) : people.length === 0 ? (
                            <p className="text-[11px] text-slate-500 py-2">No one else has access yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {people.map((person)=>(
                                    <div key={person.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-slate-800 truncate">{person.recipient?.name || "User"}</p>
                                            <p className="text-[11px] text-slate-500 truncate">{person.recipient?.email}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium capitalize">
                                                {person.permission === "view" ? "Can view" : "Can download"}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={()=> handleRevokePerson(person.id)}
                                                aria-label={`Revoke access for ${person.recipient?.email}`}
                                                className="p-1 text-slate-400 hover:text-red-600"
                                            >
                                                <XIcon className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    </Modal>
  )
}

export default ShareModal
