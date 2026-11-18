import { CheckIcon, CopyIcon, ExternalLinkIcon, HistoryIcon, LinkIcon, MailIcon, Trash2Icon, UsersIcon, XIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { copyShareLink, getFileIcon } from '../assets/assets'
import { format } from 'date-fns'
import api from '../config/api'
import toast from 'react-hot-toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const accessLabel = (entry) => {
  if (!entry.success) {
    if (entry.access_reason === 'share_link_expired') return 'Expired link'
    if (entry.access_reason === 'resource_unavailable') return 'Item unavailable'
    return 'Failed attempt'
  }
  if (entry.access_reason === 'shared_link_download' || entry.access_reason === 'direct_download') return 'Download'
  if (entry.access_reason === 'shared_link_view' || entry.access_reason === 'direct_view') return 'View'
  return 'Access'
}

const isDownloadEntry = (entry) =>
  entry.success && (entry.access_reason === 'shared_link_download' || entry.access_reason === 'direct_download')

const viewerLabel = (entry) =>
  entry.viewer_name || entry.user_name || entry.viewer_email || entry.user_email || 'Anonymous visitor'

const SharedFile = () => {

  const [tab, setTab] = useState('links')
  const [shares, setShares] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [directShares, setDirectShares] = useState([])
  const [isDirectLoading, setIsDirectLoading] = useState(true)
  const [deletingShare, setDeletingShare] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [revokingShare, setRevokingShare] = useState(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [copiedToken, setCopiedToken] = useState(null)
  const [activityShare, setActivityShare] = useState(null)
  const [accessHistory, setAccessHistory] = useState([])
  const [accessSummary, setAccessSummary] = useState(null)
  const [isAccessLoading, setIsAccessLoading] = useState(false)

   const fetchShares = async () => {
     setIsLoading(true);
     try {
      const { data } = await api.get("/api/shares")
      setShares(data.share_links || [])
     } catch {
       toast.error("Error loading shared links.");
     }finally{
      setIsLoading(false)
     }
   }

   const fetchDirectShares = async () => {
     setIsDirectLoading(true)
     try {
      const { data } = await api.get("/api/shares/direct")
      setDirectShares(data.direct_shares || [])
     } catch {
       toast.error("Error loading people you shared with.");
     } finally {
      setIsDirectLoading(false)
     }
   }

   useEffect(()=>{
    fetchShares()
    fetchDirectShares()
   },[])

   const handleCopy = (token)=>{
      copyShareLink(token)
      setCopiedToken(token)
      setTimeout(()=> setCopiedToken(null), 2000)
   }

   const openAccessLog = async (share, kind = "link") => {
      setActivityShare(share)
      setAccessHistory([])
      setAccessSummary(null)
      setIsAccessLoading(true)
      try {
        const url = kind === "direct"
          ? `/api/shares/direct/${share.id}/access-history`
          : `/api/shares/${share.id}/access-history`
        const { data } = await api.get(url)
        setAccessHistory(data.history || [])
        setAccessSummary(data.summary || null)
      } catch (err) {
        toast.error(err.response?.data?.error || "Error loading access log.")
      } finally {
        setIsAccessLoading(false)
      }
   }

    const handleDeleteShare = async () => {
      if(!deletingShare) return;

      setIsDeleting(true)
      try {
        await api.delete(`/api/shares/${deletingShare.id}`)
         toast.success("Share link deleted.");
         setShares((prev)=> prev.filter((s)=>s.id !== deletingShare.id))
      } catch (err) {
        toast.error(err.response?.data?.error || "Error deleting share link.");
      } finally{
        setIsDeleting(false)
        setDeletingShare(null)
      }
    }

    const handleRevokeDirect = async () => {
      if(!revokingShare) return;

      setIsRevoking(true)
      try {
        await api.delete(`/api/shares/direct/${revokingShare.id}`)
        toast.success("Access revoked.");
        setDirectShares((prev)=> prev.filter((s)=> s.id !== revokingShare.id))
      } catch (err) {
        toast.error(err.response?.data?.error || "Error revoking access.");
      } finally {
        setIsRevoking(false)
        setRevokingShare(null)
      }
    }

  return (
    <div className="space-y-6">
      {/* page title & desc */}
       <div className="flex items-center gap-3">
          <div className='p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100'>
            <UsersIcon className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-slate-900">Sharing</h2>
            <p className='text-xs text-slate-500'>Share links and people you shared with, with who accessed them</p>
          </div>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={()=> setTab('links')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
            tab === 'links' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LinkIcon className="size-3.5" />
          Share links
        </button>
        <button
          type="button"
          onClick={()=> setTab('people')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
            tab === 'people' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <MailIcon className="size-3.5" />
          People
        </button>
      </div>

      {/* page content  */}
      {tab === 'links' && (
        isLoading ? (
          <div className='py-20 flex justify-center'>
            <Spinner size="lg" className="text-orange-600"/>
          </div>
        ) : shares.length === 0 ? (
          <EmptyState title='No shared links yet' description='Links you generate for sharing files and folders will appear here.' icon={UsersIcon}/>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shares.map((share)=>(
              <div key={share.id} className='bg-white border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between'>
                {/* card top */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {getFileIcon(share.resource?.mime_type)}
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{share.resource?.name || "Shared Item"}</h4>
                    </div>
                    <button onClick={()=> setDeletingShare(share)} className='p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0' title='Delete Share Link'>
                      <Trash2Icon className="size-4"/>
                    </button>
                  </div>
                  <div className='text-xs text-slate-500 space-y-1 mt-3'>
                    <p>Access: <span className="text-slate-800 font-medium">Anyone with link</span></p>
                    <p>Views: <span className="text-slate-800 font-medium">{share.view_count ?? 0}</span></p>
                    <p>Downloads: <span className="text-slate-800 font-medium">{share.download_count ?? 0}</span></p>
                    <p>Last accessed: <span className="text-slate-800 font-medium">
                      {share.last_accessed ? format(new Date(share.last_accessed), "MMM d, yyyy HH:mm") : "Never"}</span></p>
                    <p>Created: {" "}<span className="text-slate-800 font-medium">
                      {format(new Date(share.created_at), "MMM d, yyyy")}</span></p>
                  </div>
                </div>
                {/* card bottom  */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button  onClick={()=> handleCopy(share.token)} className='inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 transition'>
                    {copiedToken === share.token ? (
                      <>
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-600"/>
                      <span className="text-emerald-600 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-3.5 h-3.5"/>
                      <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={()=> openAccessLog(share)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-orange-700 hover:bg-orange-50 transition"
                      title="View access log"
                    >
                      <HistoryIcon className="w-3.5 h-3.5"/>
                      <span>Access log</span>
                    </button>
                    <a href={`/s/${share.token}`} target='_blank' rel='noreferrer' className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"  title="Open public link">
                      <ExternalLinkIcon className="w-3.5 h-3.5"/>
                    </a>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'people' && (
        isDirectLoading ? (
          <div className='py-20 flex justify-center'>
            <Spinner size="lg" className="text-orange-600"/>
          </div>
        ) : directShares.length === 0 ? (
          <EmptyState title='No one has access yet' description='Items you send directly to a user from the share dialog will appear here.' icon={MailIcon}/>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {directShares.map((share)=>(
              <div key={share.id} className='bg-white border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between'>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {getFileIcon(share.resource?.mime_type)}
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{share.resource?.name || "Shared Item"}</h4>
                    </div>
                    <button onClick={()=> setRevokingShare(share)} className='p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0' title='Revoke access'>
                      <XIcon className="size-4"/>
                    </button>
                  </div>

                  <div className='mt-3 flex items-center gap-2'>
                    <div className="size-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {(share.recipient?.name || share.recipient?.email || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{share.recipient?.name || "User"}</p>
                      <p className="text-[11px] text-slate-500 truncate">{share.recipient?.email}</p>
                    </div>
                  </div>

                  <div className='text-xs text-slate-500 space-y-1 mt-3'>
                    <p>Permission: <span className="text-slate-800 font-medium capitalize">{share.permission === 'view' ? 'Can view only' : 'Can download'}</span></p>
                    <p>Views: <span className="text-slate-800 font-medium">{share.view_count ?? 0}</span></p>
                    <p>Downloads: <span className="text-slate-800 font-medium">{share.download_count ?? 0}</span></p>
                    <p>Last accessed: <span className="text-slate-800 font-medium">
                      {share.last_accessed ? format(new Date(share.last_accessed), "MMM d, yyyy HH:mm") : "Never"}</span></p>
                    <p>Shared: {" "}<span className="text-slate-800 font-medium">
                      {share.created_at ? format(new Date(share.created_at), "MMM d, yyyy") : "—"}</span></p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                  <button
                    onClick={()=> openAccessLog(share, 'direct')}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-orange-700 hover:bg-orange-50 transition"
                    title="View access log"
                  >
                    <HistoryIcon className="w-3.5 h-3.5"/>
                    <span>Access log</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Access log modal */}
      <Modal
        isOpen={!!activityShare}
        onClose={()=> setActivityShare(null)}
        title={`Access log - ${activityShare?.resource?.name || "Shared item"}`}
        maxWidth="max-w-2xl"
      >
        {isAccessLoading ? (
          <div className="py-10 flex justify-center">
            <Spinner size="lg" className="text-orange-600"/>
          </div>
        ) : (
          <div className="space-y-4">
            {activityShare?.recipient && (
              <p className="text-xs text-slate-600">
                Shared directly with <span className="font-medium text-slate-800">{activityShare.recipient.name}</span>{" "}
                ({activityShare.recipient.email})
              </p>
            )}

            {accessSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] text-slate-500">Total accesses</p>
                  <p className="text-lg font-semibold text-slate-900">{accessSummary.total_accesses ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] text-slate-500">Unique viewers</p>
                  <p className="text-lg font-semibold text-slate-900">{accessSummary.unique_viewers ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] text-slate-500">Views</p>
                  <p className="text-lg font-semibold text-slate-900">{accessSummary.views ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] text-slate-500">Downloads</p>
                  <p className="text-lg font-semibold text-slate-900">{accessSummary.downloads ?? 0}</p>
                </div>
              </div>
            )}

            {accessHistory.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No access recorded yet. It will show up here as soon as someone opens or downloads it.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[45vh] overflow-y-auto divide-y divide-slate-100">
                  {accessHistory.map((entry)=>(
                    <div key={entry.id} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">{viewerLabel(entry)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            !entry.success
                              ? 'bg-red-50 text-red-600'
                              : isDownloadEntry(entry)
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-orange-50 text-orange-700'
                          }`}>
                            {accessLabel(entry)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {entry.ip_address || "IP not recorded"}
                          {entry.user_agent ? ` · ${entry.user_agent.slice(0, 60)}` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                        {format(new Date(entry.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Delete Share Link Dialog */}
      {deletingShare && (
        <ConfirmDialog 
        isOpen={!!deletingShare} 
        onClose={()=> setDeletingShare(null)}
        onConfirm={handleDeleteShare}
        title={`Delete share link for "${deletingShare.resource?.name || "this item"}"?`}
        message='Anyone who currently has this link will no longer be able to access the shared file or folder.'
        confirmText='Delete Link'
        isLoading={isDeleting}
        />
      )}

      {/* Confirm Revoke Direct Access Dialog */}
      {revokingShare && (
        <ConfirmDialog
        isOpen={!!revokingShare}
        onClose={()=> setRevokingShare(null)}
        onConfirm={handleRevokeDirect}
        title={`Revoke access for ${revokingShare.recipient?.name || revokingShare.recipient?.email || "this user"}?`}
        message='They will no longer see this item under "Shared with Me". You can share it again later.'
        confirmText='Revoke Access'
        isLoading={isRevoking}
        />
      )}

    </div>
  )
}

export default SharedFile
