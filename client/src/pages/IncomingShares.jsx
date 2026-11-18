import { DownloadIcon, EyeIcon, FolderIcon, InboxIcon, LockIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { getFileIcon } from '../assets/assets'
import { format } from 'date-fns'
import api from '../config/api'
import toast from 'react-hot-toast'

const permissionLabel = (permission) => (permission === 'view' ? 'View only' : 'Can download')

const IncomingShares = () => {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const { data } = await api.get("/api/shares/shared-with-me")
      setItems(data.items || [])
    } catch (err) {
      toast.error(err.response?.data?.error || "Error loading shared items.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  return (
    <div className="space-y-6">
      {/* page title & desc */}
      <div className="flex items-center gap-3">
        <div className='p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100'>
          <InboxIcon className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-medium text-slate-900">Shared with Me</h2>
          <p className='text-xs text-slate-500'>Files and folders other people shared directly with you</p>
        </div>
      </div>

      {isLoading ? (
        <div className='py-20 flex justify-center'>
          <Spinner size="lg" className="text-orange-600"/>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title='Nothing shared with you yet'
          description='When someone shares a file or folder with your email, it will show up here.'
          icon={InboxIcon}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((share) => {
            const canDownload = share.permission === 'download'
            const isFolder = share.resource_type === 'folder'

            return (
              <div key={share.id} className='bg-white border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between'>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {isFolder ? <FolderIcon className="size-5 text-orange-500 shrink-0" /> : getFileIcon(share.resource?.mime_type)}
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{share.resource?.name || "Shared Item"}</h4>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                      canDownload ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {canDownload ? <DownloadIcon className="size-3" /> : <LockIcon className="size-3" />}
                      {permissionLabel(share.permission)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 truncate">
                    From <span className="font-medium text-slate-700">{share.owner_info?.name || "Someone"}</span>
                    {" "}({share.owner_info?.email})
                  </p>
                  {share.created_at && (
                    <p className="text-[11px] text-slate-500">
                      Shared on {format(new Date(share.created_at), "MMM d, yyyy")}
                    </p>
                  )}

                  {/* file action */}
                  {!isFolder && (
                    <div className="mt-3">
                      {canDownload && share.url ? (
                        <a
                          href={share.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => api.post(`/api/shares/direct/${share.id}/open`).catch(() => {})}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 transition"
                        >
                          <DownloadIcon className="size-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <EyeIcon className="size-3.5" />
                          View only
                        </span>
                      )}
                    </div>
                  )}

                  {/* folder contents */}
                  {isFolder && (
                    <div className="mt-3 space-y-1.5">
                      {share.files?.length === 0 ? (
                        <p className="text-[11px] text-slate-500">This folder is empty.</p>
                      ) : (
                        share.files?.map((file) => (
                          <div key={file.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-slate-700">{file.name}</span>
                            {canDownload && file.url ? (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => api.post(`/api/shares/direct/${share.id}/open`).catch(() => {})}
                                className="text-orange-600 hover:text-orange-700 shrink-0"
                                title={`Download ${file.name}`}
                              >
                                <DownloadIcon className="size-3.5" />
                              </a>
                            ) : (
                              <LockIcon className="size-3 text-slate-300 shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default IncomingShares
