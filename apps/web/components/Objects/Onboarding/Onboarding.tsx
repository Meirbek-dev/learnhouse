'use client'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Image, { StaticImageData } from 'next/image'
import type { ReactNode, FC } from 'react'
import { useEffect, useState } from 'react'
import OnBoardWelcome from '@public/onboarding/OnBoardWelcome.png'
import OnBoardCourses from '@public/onboarding/OnBoardCourses.png'
import OnBoardActivities from '@public/onboarding/OnBoardActivities.png'
import OnBoardEditor from '@public/onboarding/OnBoardEditor.png'
import OnBoardAI from '@public/onboarding/OnBoardAI.png'
import OnBoardUGs from '@public/onboarding/OnBoardUGs.png'
import OnBoardAccess from '@public/onboarding/OnBoardAccess.png'
import OnBoardMore from '@public/onboarding/OnBoardMore.png'
import OnBoardAssignments from '@public/onboarding/OnBoardAssignments.png'
import OnBoardPayments from '@public/onboarding/OnBoardPayments.png'
import {
  ArrowRight,
  Book,
  Check,
  Globe,
  Info,
  PictureInPicture,
  Sparkle,
  Sprout,
  SquareUser,
  CreditCard,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useTranslations } from 'next-intl'
import { useIsMobile } from '@/hooks/useIsMobile'

interface OnboardingStep {
  imageSrc: StaticImageData
  title: string
  description: string
  buttons?: {
    label: string
    action: () => void
    icon?: ReactNode
  }[]
}

const Onboarding: FC = () => {
  const t = useTranslations('Components.Onboarding')
  const [currentStep, setCurrentStep] = useState(() => {
    // Initialize with saved step or 0
    const savedStep = localStorage.getItem('onboardingLastStep')
    return savedStep ? parseInt(savedStep) : 0
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true)
  const [isTemporarilyClosed, setIsTemporarilyClosed] = useState(false)
  const isMobile = useIsMobile()
  const router = useRouter()
  const org = useOrg() as any
  const isUserAdmin = useAdminStatus() as any

  const onboardingData: OnboardingStep[] = [
    {
      imageSrc: OnBoardWelcome,
      title: t('step1Title'),
      description: t('step1Desc'),
    },
    {
      imageSrc: OnBoardCourses,
      title: t('step2Title'),
      description: t('step2Desc'),
      buttons: [
        {
          label: t('step2Button'),
          action: () =>
            router.push(getUriWithOrg(org?.slug, '/courses?new=true')),
          icon: <Book size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardActivities,
      title: t('step3Title'),
      description: t('step3Desc'),
      buttons: [
        {
          label: t('step3Button'),
          action: () =>
            window.open(
              'https://university.learnhouse.io/course/be89716c-9992-44bb-81df-ef3d76e355ba',
              '_blank'
            ),
          icon: <Info size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardEditor,
      title: t('step4Title'),
      description: t('step4Desc'),
      buttons: [
        {
          label: t('step4Button'),
          action: () =>
            window.open(
              'https://university.learnhouse.io/course/be89716c-9992-44bb-81df-ef3d76e355ba',
              '_blank'
            ),
          icon: <Info size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardAI,
      title: t('step5Title'),
      description: t('step5Desc'),
      buttons: [
        {
          label: t('step5Button'),
          action: () =>
            window.open(
              'https://docs.learnhouse.app/features/ai/students',
              '_blank'
            ),
          icon: <Sparkle size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardUGs,
      title: t('step6Title'),
      description: t('step6Desc'),
      buttons: [
        {
          label: t('step6Button'),
          action: () =>
            router.push(
              getUriWithOrg(org?.slug, '/dash/users/settings/usergroups')
            ),
          icon: <SquareUser size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardAccess,
      title: t('step7Title'),
      description: t('step7Desc'),
      buttons: [],
    },
    {
      imageSrc: OnBoardAssignments,
      title: t('step8Title'),
      description: t('step8Desc'),
      buttons: [
        {
          label: t('step8Button'),
          action: () =>
            router.push(getUriWithOrg(org?.slug, '/dash/assignments?new=true')),
          icon: <Book size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardPayments,
      title: t('step9Title'),
      description: t('step9Desc'),
      buttons: [
        {
          label: t('step9Button'),
          action: () =>
            router.push(getUriWithOrg(org?.slug, '/dash/payments/customers')),
          icon: <CreditCard size={16} />,
        },
      ],
    },
    {
      imageSrc: OnBoardMore,
      title: t('step10Title'),
      description: t('step10Desc'),
      buttons: [
        {
          label: t('step10Button'),
          action: () =>
            window.open('https://university.learnhouse.io', '_blank'),
          icon: <Globe size={16} />,
        },
      ],
    },
  ]

  useEffect(() => {
    // Check both completion and temporary closure status
    const isOnboardingCompleted = localStorage.getItem('isOnboardingCompleted')
    const temporarilyClosed = localStorage.getItem(
      'onboardingTemporarilyClosed'
    )
    const lastClosedTime = localStorage.getItem('onboardingLastClosedTime')

    setIsOnboardingComplete(isOnboardingCompleted === 'true')
    setIsTemporarilyClosed(temporarilyClosed === 'true')

    // If temporarily closed, check if 24 hours have passed
    if (temporarilyClosed === 'true' && lastClosedTime) {
      const hoursSinceClosed =
        (Date.now() - parseInt(lastClosedTime)) / (1000 * 60 * 60)
      if (hoursSinceClosed >= 24) {
        // Reset temporary closure after 24 hours
        localStorage.removeItem('onboardingTemporarilyClosed')
        localStorage.removeItem('onboardingLastClosedTime')
        setIsTemporarilyClosed(false)
      }
    }

    // Show modal if onboarding is not completed and not temporarily closed
    setIsModalOpen(!isOnboardingCompleted && !temporarilyClosed)
  }, [])

  // Update stored step whenever currentStep changes
  useEffect(() => {
    localStorage.setItem('onboardingLastStep', currentStep.toString())
  }, [currentStep])

  const handleModalClose = () => {
    // Store temporary closure status and timestamp
    localStorage.setItem('onboardingTemporarilyClosed', 'true')
    localStorage.setItem('onboardingLastClosedTime', Date.now().toString())
    // Current step is already saved via the useEffect above
    setIsTemporarilyClosed(true)
    setIsModalOpen(false)
  }

  const nextStep = () => {
    if (currentStep < onboardingData.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Mark onboarding as completed in local storage
      localStorage.setItem('isOnboardingCompleted', 'true')
      localStorage.removeItem('onboardingLastStep') // Clean up stored step
      setIsModalOpen(false)
      setIsOnboardingComplete(true)
      console.log('Onboarding completed')
    }
  }

  const skipOnboarding = () => {
    localStorage.setItem('isOnboardingCompleted', 'true')
    localStorage.removeItem('onboardingLastStep') // Clean up stored step
    setIsModalOpen(false)
    setIsOnboardingComplete(true)
    console.log('Onboarding skipped')
  }

  const goToStep = (index: number) => {
    if (index >= 0 && index < onboardingData.length) {
      setCurrentStep(index)
    }
  }

  return (
    <div>
      {isUserAdmin.isAdmin &&
        !isUserAdmin.loading &&
        !isOnboardingComplete &&
        !isMobile && (
          <Modal
            isDialogOpen={isModalOpen}
            onOpenChange={setIsModalOpen}
            minHeight="sm"
            minWidth="md"
            dialogContent={
              <OnboardingScreen
                step={onboardingData[currentStep]}
                onboardingData={onboardingData}
                currentStep={currentStep}
                nextStep={nextStep}
                skipOnboarding={skipOnboarding}
                setIsModalOpen={handleModalClose}
                goToStep={goToStep}
              />
            }
            dialogTrigger={
              <div className="fixed bottom-0 w-full bg-linear-to-t from-gray-950/25 from-1% to-transparent pb-10">
                <div className="mx-auto flex w-fit cursor-pointer items-center space-x-2 rounded-full bg-gray-950 px-5 py-2 font-bold text-gray-200 shadow-md hover:bg-gray-900">
                  <Sprout size={20} />
                  <p>{t('onboarding')}</p>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                  <div
                    className="ml-2 cursor-pointer border-l border-gray-700 pl-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      skipOnboarding()
                    }}
                  >
                    <Check size={16} className="hover:text-green-500" />
                  </div>
                </div>
              </div>
            }
          />
        )}
    </div>
  )
}

interface OnboardingScreenProps {
  step: OnboardingStep
  currentStep: number
  nextStep: () => void
  skipOnboarding: () => void
  goToStep: (index: number) => void
  setIsModalOpen: (value: boolean) => void
  onboardingData: OnboardingStep[]
}

const OnboardingScreen: FC<OnboardingScreenProps> = ({
  step,
  currentStep,
  nextStep,
  skipOnboarding,
  goToStep,
  onboardingData,
  setIsModalOpen,
}) => {
  const t = useTranslations('Components.Onboarding')

  const isLastStep = currentStep === onboardingData.length - 1

  return (
    <div className="flex flex-col">
      <div className="onboarding_screens flex-col px-4 py-4">
        <div className="grow rounded-xl">
          <Image
            unoptimized
            className="mx-auto h-[330px] w-[730px] rounded-lg object-cover shadow-md shadow-gray-200"
            alt=""
            priority
            quality={100}
            src={step.imageSrc}
          />
        </div>
        <div className="mt-4 grid grid-flow-col justify-stretch space-x-3">
          {onboardingData.map((_, index) => (
            <div
              key={index}
              onClick={() => goToStep(index)}
              className={`h-[7px] w-auto ${index === currentStep ? 'bg-black' : 'bg-gray-300'} cursor-pointer rounded-lg shadow-md hover:bg-gray-700`}
            ></div>
          ))}
        </div>
      </div>
      <div className="onboarding_text flex h-[90px] flex-col px-4 py-2 leading-tight">
        <h2 className="text-xl font-bold">{step.title}</h2>
        <p className="text-md font-normal">{step.description}</p>
      </div>
      <div className="onboarding_actions flex w-full flex-row-reverse px-4">
        <div className="flex w-full flex-row justify-between py-2">
          <div className="utils_buttons flex flex-row space-x-2">
            <div
              className="inline-flex cursor-pointer items-center space-x-1 rounded-full bg-gray-100 px-5 py-1 font-bold text-gray-600 antialiased hover:bg-gray-200"
              onClick={() => setIsModalOpen(false)}
            >
              <PictureInPicture size={16} />
            </div>
            <div
              className="inline-flex cursor-pointer items-center space-x-2 rounded-full bg-gray-100 px-5 py-1 font-bold text-gray-600 antialiased hover:bg-gray-200"
              onClick={skipOnboarding}
            >
              <p>{t('endButtonLabel')}</p>
              <Check size={16} />
            </div>
          </div>
          <div className="actions_buttons flex space-x-2">
            {step.buttons?.map((button, index) => (
              <div
                key={index}
                className="inline-flex cursor-pointer items-center space-x-2 rounded-full bg-black px-5 py-1 font-bold whitespace-nowrap text-gray-200 antialiased shadow-md hover:bg-gray-700"
                onClick={button.action}
              >
                <p>{button.label}</p>
                {button.icon}
              </div>
            ))}
            {isLastStep ? (
              <div
                className="inline-flex cursor-pointer items-center space-x-2 rounded-full bg-black px-5 py-1 font-bold whitespace-nowrap text-gray-200 antialiased shadow-md hover:bg-gray-700"
                onClick={nextStep}
              >
                <p>{t('finishButtonLabel')}</p>
                <Check size={16} />
              </div>
            ) : (
              <div
                className="inline-flex cursor-pointer items-center space-x-2 rounded-full bg-black px-5 py-1 font-bold whitespace-nowrap text-gray-200 antialiased shadow-md hover:bg-gray-700"
                onClick={nextStep}
              >
                <p>{t('nextButtonLabel')}</p>
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
