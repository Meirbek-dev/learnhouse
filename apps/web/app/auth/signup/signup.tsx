'use client'
import openuIcon from 'public/openu_bigicon_1.png'
import Image from 'next/image'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useState, useEffect } from 'react'
import { MailWarning, Ticket, UserPlus } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import UserAvatar from '@components/Objects/UserAvatar'
import OpenSignUpComponent from './OpenSignup'
import InviteOnlySignUpComponent from './InviteOnlySignUp'
import { useRouter, useSearchParams } from 'next/navigation'
import { validateInviteCode } from '@services/organizations/invites'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import toast from 'react-hot-toast'
import { BarLoader } from 'react-spinners'
import { joinOrg } from '@services/organizations/orgs'
import { useTranslations } from 'next-intl'

interface SignUpClientProps {
  org: any
}

function SignUpClient(props: SignUpClientProps) {
  const t = useTranslations('Auth.Signup')
  const session = useLHSession() as any
  const [joinMethod, setJoinMethod] = useState('open')
  const [inviteCode, setInviteCode] = useState('')
  const searchParams = useSearchParams()
  const inviteCodeParam = searchParams.get('inviteCode')

  useEffect(() => {
    if (props.org.config) {
      setJoinMethod(props.org?.config?.config?.features.members.signup_mode)
    }
    if (inviteCodeParam) {
      setInviteCode(inviteCodeParam)
    }
  }, [props.org, inviteCodeParam])

  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div
        className="right-login-part"
        style={{
          background:
            'linear-gradient(041.61deg, #202020 7.15%, #000000 90.96%)',
        }}
      >
        <div className="login-topbar m-10">
          <Link prefetch href={getUriWithOrg(props.org.slug, '/')}>
            <Image
              quality={100}
              width={30}
              height={30}
              src={openuIcon}
              alt=""
            />
          </Link>
        </div>
        <div className="ml-10 flex h-3/4 flex-row text-white">
          <div className="m-auto flex flex-wrap items-center space-x-4">
            <div>{t('invitedToJoin')} </div>
            <div className="shadow-[0px_4px_16px_rgba(0,0,0,0.02)]">
              {props.org?.logo_image ? (
                <img
                  src={`${getOrgLogoMediaDirectory(
                    props.org.org_uuid,
                    props.org?.logo_image
                  )}`}
                  alt="OpenU"
                  style={{ width: 'auto', height: 70 }}
                  className="inset-0 rounded-xl bg-white shadow-xl ring-1 ring-inset ring-black/10"
                />
              ) : (
                <Image
                  quality={100}
                  width={70}
                  height={70}
                  src={openuIcon}
                  alt=""
                />
              )}
            </div>
            <div className="text-xl font-bold">{props.org?.name}</div>
          </div>
        </div>
      </div>
      <div className="left-join-part flex flex-row bg-white">
        {joinMethod == 'open' &&
          (session.status == 'authenticated' ? (
            <LoggedInJoinScreen inviteCode={inviteCode} />
          ) : (
            <OpenSignUpComponent />
          ))}
        {joinMethod == 'inviteOnly' &&
          (inviteCode ? (
            session.status == 'authenticated' ? (
              <LoggedInJoinScreen inviteCode={inviteCode} />
            ) : (
              <InviteOnlySignUpComponent inviteCode={inviteCode} />
            )
          ) : (
            <NoTokenScreen />
          ))}
      </div>
    </div>
  )
}

const LoggedInJoinScreen = (props: any) => {
  const t = useTranslations('Auth.Signup')
  const toastT = useTranslations('ToastMessages')
  const session = useLHSession() as any
  const org = useOrg() as any
  const [_isLoading, setIsLoading] = useState(true)
  const [isSumbitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const join = async () => {
    setIsSubmitting(true)
    const res = await joinOrg(
      {
        org_id: org.id,
        user_id: session?.data?.user?.id,
        invite_code: props.inviteCode,
      },
      null,
      session.data?.tokens?.access_token
    )
    //wait for 1.5s
    if (res.success) {
      toast.success(res.data + toastT('orgJoinSuccess'))
      setTimeout(() => {
        router.push(getUriWithOrg(org.slug, '/'))
      }, 1500)
      setIsSubmitting(false)
    } else {
      toast.error(res.data?.detail || toastT('errorSomethingWentWrong'))
      setIsLoading(false)
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (session && org) {
      setIsLoading(false)
    }
  }, [org, session])

  return (
    <div className="mx-auto flex flex-row items-center">
      <Toast />
      <div className="flex flex-col items-center justify-center space-y-7">
        <p className="flex items-center justify-center space-x-2 pt-3 text-2xl font-semibold text-black/70">
          <span className="items-center">{t('hi')}</span>
          <span className="flex items-center space-x-2 capitalize">
            <UserAvatar rounded="rounded-xl" border="border-4" width={35} />
            <span>{session.data.username},</span>
          </span>
          <span>{t('joinQuestion', { orgName: org?.name })}</span>
        </p>
        <button
          onClick={() => join()}
          className="text-md flex h-[35px] w-fit items-center space-x-2 rounded-lg bg-black px-6 py-2 font-semibold text-white shadow-md"
        >
          {isSumbitting ? (
            <BarLoader
              cssOverride={{ borderRadius: 60 }}
              width={60}
              color="#ffffff"
            />
          ) : (
            <>
              <UserPlus size={18} />
              <p>{t('join')}</p>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

const NoTokenScreen = (_props: any) => {
  const toastT = useTranslations('ToastMessages')
  const t = useTranslations('Auth.Signup')
  const session = useLHSession() as any
  const org = useOrg() as any
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')

  const handleInviteCodeChange = (e: any) => {
    setInviteCode(e.target.value)
  }

  const validateCode = async () => {
    setIsLoading(true)
    const res = await validateInviteCode(
      org?.id,
      inviteCode,
      session?.user?.tokens.access_token
    )
    //wait for 1.5s
    if (res.success) {
      toast.success(toastT('inviteCodeValid'))
      setTimeout(() => {
        router.push(
          getUriWithoutOrg(
            `/signup?inviteCode=${inviteCode}&orgslug=${org.slug}`
          )
        )
      }, 1500)
    } else {
      toast.error(res.data?.detail || toastT('inviteCodeInvalid'))
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session && org) {
      setIsLoading(false)
    }
  }, [org, session])

  return (
    <div className="mx-auto flex flex-row items-center">
      <Toast />
      {isLoading ? (
        <div className="flex w-[300px] flex-col items-center justify-center space-y-7">
          <PageLoading />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-7">
          <p className="flex items-center space-x-2 text-lg font-medium text-red-800">
            <MailWarning size={18} />
            <span>{t('inviteCodeRequired', { orgName: org?.name })}</span>
          </p>
          <input
            onChange={handleInviteCodeChange}
            className="h-[50px] w-[300px] rounded-lg bg-white px-5 outline-2 outline-gray-200"
            placeholder={t('enterInviteCode')}
            type="text"
          />
          <button
            onClick={validateCode}
            className="text-md flex h-fit w-fit items-center space-x-2 rounded-lg bg-black px-6 py-2 font-semibold text-white shadow-md"
          >
            <Ticket size={18} />
            <p>{t('submit')}</p>
          </button>
        </div>
      )}
    </div>
  )
}

export default SignUpClient
