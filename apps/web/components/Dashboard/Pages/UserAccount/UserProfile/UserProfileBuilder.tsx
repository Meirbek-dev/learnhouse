import type { FC } from 'react'
import { useState, useEffect, createElement } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Plus,
  Trash2,
  GripVertical,
  ImageIcon,
  Link as LinkIcon,
  Award,
  Edit,
  TextIcon,
  Briefcase,
  GraduationCap,
  MapPin,
  BookOpen,
} from 'lucide-react'
import { Input } from '@components/ui/input'
import { Textarea } from '@components/ui/textarea'
import { Label } from '@components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select'
import { Button } from '@components/ui/button'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updateProfile } from '@services/settings/profile'
import { getUser } from '@services/users/users'
import { toast } from 'react-hot-toast'
import { useTranslations } from 'next-intl'

// Define section type keys (mapping to translation keys)
const SECTION_TYPE_KEYS = {
  'image-gallery': 'imageGallery',
  text: 'text',
  links: 'links',
  skills: 'skills',
  experience: 'experience',
  education: 'education',
  affiliation: 'affiliation',
  courses: 'courses',
} as const

// Function to get translated section types configuration
const getSectionTypesConfig = (t: Function) => ({
  'image-gallery': {
    icon: ImageIcon,
    label: t('SectionTypes.imageGallery.label'),
    description: t('SectionTypes.imageGallery.description'),
  },
  text: {
    icon: TextIcon,
    label: t('SectionTypes.text.label'),
    description: t('SectionTypes.text.description'),
  },
  links: {
    icon: LinkIcon,
    label: t('SectionTypes.links.label'),
    description: t('SectionTypes.links.description'),
  },
  skills: {
    icon: Award,
    label: t('SectionTypes.skills.label'),
    description: t('SectionTypes.skills.description'),
  },
  experience: {
    icon: Briefcase,
    label: t('SectionTypes.experience.label'),
    description: t('SectionTypes.experience.description'),
  },
  education: {
    icon: GraduationCap,
    label: t('SectionTypes.education.label'),
    description: t('SectionTypes.education.description'),
  },
  affiliation: {
    icon: MapPin,
    label: t('SectionTypes.affiliation.label'),
    description: t('SectionTypes.affiliation.description'),
  },
  courses: {
    icon: BookOpen,
    label: t('SectionTypes.courses.label'),
    description: t('SectionTypes.courses.description'),
  },
})

// Type definitions
interface ProfileImage {
  url: string
  caption?: string
}

interface ProfileLink {
  title: string
  url: string
  icon?: string
}

interface ProfileSkill {
  name: string
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  category?: string
}

interface ProfileExperience {
  title: string
  organization: string
  startDate: string
  endDate?: string
  current: boolean
  description: string
}

interface ProfileEducation {
  institution: string
  degree: string
  field: string
  startDate: string
  endDate?: string
  current: boolean
  description?: string
}

interface ProfileAffiliation {
  name: string
  description: string
  logoUrl: string
}

interface Course {
  id: string
  title: string
  description: string
  thumbnail?: string
  status: string
}

interface BaseSection {
  id: string
  type: keyof typeof SECTION_TYPE_KEYS
  title: string
}

interface ImageGallerySection extends BaseSection {
  type: 'image-gallery'
  images: ProfileImage[]
}

interface TextSection extends BaseSection {
  type: 'text'
  content: string
}

interface LinksSection extends BaseSection {
  type: 'links'
  links: ProfileLink[]
}

interface SkillsSection extends BaseSection {
  type: 'skills'
  skills: ProfileSkill[]
}

interface ExperienceSection extends BaseSection {
  type: 'experience'
  experiences: ProfileExperience[]
}

interface EducationSection extends BaseSection {
  type: 'education'
  education: ProfileEducation[]
}

interface AffiliationSection extends BaseSection {
  type: 'affiliation'
  affiliations: ProfileAffiliation[]
}

interface CoursesSection extends BaseSection {
  type: 'courses'
  // No need to store courses as they will be fetched from API
}

type ProfileSection =
  | ImageGallerySection
  | TextSection
  | LinksSection
  | SkillsSection
  | ExperienceSection
  | EducationSection
  | AffiliationSection
  | CoursesSection

interface ProfileData {
  sections: ProfileSection[]
}

const UserProfileBuilder = () => {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const t = useTranslations('Dashboard.UserProfileBuilder')
  const tNotify = useTranslations('Notifications')
  const [profileData, setProfileData] = useState<ProfileData>({
    sections: [],
  })
  const [selectedSection, setSelectedSection] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize profile data from user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.data?.user?.id && access_token) {
        try {
          setIsLoading(true)
          const userData = await getUser(session.data.user.id)

          if (userData.profile) {
            try {
              const profileSections =
                typeof userData.profile === 'string'
                  ? JSON.parse(userData.profile).sections
                  : userData.profile.sections

              setProfileData({
                sections: profileSections || [],
              })
            } catch (error) {
              console.error('Error parsing profile data:', error)
              setProfileData({ sections: [] })
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          toast.error('Failed to load profile data')
          toast.error(tNotify('profileLoadFailed'))
        } finally {
          setIsLoading(false)
        }
      }
    }

    fetchUserData()
  }, [session?.data?.user?.id, access_token])

  const createEmptySection = (
    t: Function,
    type: keyof typeof SECTION_TYPE_KEYS
  ): ProfileSection => {
    const sectionTypesConfig = getSectionTypesConfig(t)
    const _sectionTypeKey = SECTION_TYPE_KEYS[type]
    const baseSection = {
      id: `section-${Date.now()}`,
      type,
      title: t('EmptySections.defaultTitle', {
        sectionName: sectionTypesConfig[type].label,
      }),
    }

    switch (type) {
      case 'image-gallery':
        return {
          ...baseSection,
          type: 'image-gallery',
          images: [],
        }
      case 'text':
        return {
          ...baseSection,
          type: 'text',
          content: '',
        }
      case 'links':
        return {
          ...baseSection,
          type: 'links',
          links: [],
        }
      case 'skills':
        return {
          ...baseSection,
          type: 'skills',
          skills: [],
        }
      case 'experience':
        return {
          ...baseSection,
          type: 'experience',
          experiences: [],
        }
      case 'education':
        return {
          ...baseSection,
          type: 'education',
          education: [],
        }
      case 'affiliation':
        return {
          ...baseSection,
          type: 'affiliation',
          affiliations: [],
        }
      case 'courses':
        return {
          ...baseSection,
          type: 'courses',
        }
    }
  }

  const addSection = (type: keyof typeof SECTION_TYPE_KEYS) => {
    const newSection = createEmptySection(t, type)
    setProfileData((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }))
    setSelectedSection(profileData.sections.length)
  }

  const updateSection = (index: number, updatedSection: ProfileSection) => {
    const newSections = [...profileData.sections]
    newSections[index] = updatedSection
    setProfileData((prev) => ({
      ...prev,
      sections: newSections,
    }))
  }

  const deleteSection = (index: number) => {
    setProfileData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }))
    setSelectedSection(null)
  }

  const onDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(profileData.sections)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    setProfileData((prev) => ({
      ...prev,
      sections: items,
    }))
    setSelectedSection(result.destination.index)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const loadingToast = toast.loading(tNotify('savingProfile'))

    try {
      // Get fresh user data before update
      const userData = await getUser(session.data.user.id)

      // Update only the profile field
      userData.profile = profileData

      const res = await updateProfile(userData, userData.id, access_token)

      if (res.status === 200) {
        toast.success(tNotify('profileUpdateSuccess'), { id: loadingToast })
      } else {
        toast.error(tNotify('profileUpdateFailed'), { id: loadingToast })
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error(tNotify('profileUpdateFailed'), { id: loadingToast })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="nice-shadow mx-0 rounded-xl bg-white p-6 sm:mx-10">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
        </div>
      </div>
    )
  }

  return (
    <div className="nice-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="flex items-center text-xl font-semibold">
              {t('title')}{' '}
              <div className="ml-2 rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700">
                {t('betaBadge')}
              </div>
            </h2>
            <p className="text-gray-600">{t('description')}</p>
          </div>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-black hover:bg-black/90"
          >
            {isSaving ? t('savingButton') : t('saveButton')}
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-4 gap-6">
          {/* Sections Panel */}
          <div className="col-span-1 border-r pr-4">
            <h3 className="mb-4 font-medium">{t('SectionsPanel.title')}</h3>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {profileData.sections.map((section, index) => (
                      <Draggable
                        key={section.id}
                        draggableId={section.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onClick={() => setSelectedSection(index)}
                            className={`backdrop-blur-xs cursor-pointer rounded-lg border bg-white/80 p-4 ${
                              selectedSection === index
                                ? 'shadow-xs border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                                : 'hover:shadow-xs border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                            } ${snapshot.isDragging ? 'rotate-2 shadow-lg ring-2 ring-blue-500/20' : ''}`}
                          >
                            <div className="group flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div
                                  {...provided.dragHandleProps}
                                  className={`rounded-md p-1.5 transition-colors duration-200 ${
                                    selectedSection === index
                                      ? 'bg-blue-100/50 text-blue-500'
                                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                  }`}
                                >
                                  <GripVertical size={16} />
                                </div>
                                <div
                                  className={`rounded-md p-1.5 ${
                                    selectedSection === index
                                      ? 'bg-blue-100/50 text-blue-600'
                                      : 'bg-gray-100/50 text-gray-600'
                                  }`}
                                >
                                  {createElement(
                                    getSectionTypesConfig(t)[section.type].icon,
                                    {
                                      size: 16,
                                    }
                                  )}
                                </div>
                                <span
                                  className={`truncate text-sm font-medium ${
                                    selectedSection === index
                                      ? 'text-blue-700'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  {section.title}
                                </span>
                              </div>
                              <div className="flex space-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedSection(index)
                                  }}
                                  className={`rounded-md p-1.5 transition-colors duration-200 ${
                                    selectedSection === index
                                      ? 'text-blue-500 hover:bg-blue-100'
                                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                  }`}
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteSection(index)
                                  }}
                                  className="rounded-md p-1.5 text-red-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-500"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="pt-4">
              <Select
                onValueChange={(value: keyof typeof SECTION_TYPE_KEYS) => {
                  if (value) {
                    addSection(value)
                  }
                }}
              >
                <SelectTrigger className="w-full border-0 bg-black p-0">
                  <div className="w-full">
                    <Button
                      variant="default"
                      className="w-full bg-black text-white hover:bg-black/90"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('SectionsPanel.addSectionButton')}
                    </Button>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(getSectionTypesConfig(t)).map(
                    ([type, { icon: Icon, label, description }]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center space-x-3 py-1">
                          <div className="rounded-md bg-gray-50 p-1.5">
                            <Icon size={16} className="text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700">
                              {label}
                            </div>
                            <div className="text-xs text-gray-500">
                              {description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Editor Panel */}
          <div className="col-span-3">
            {selectedSection !== null ? (
              <SectionEditor
                t={t}
                section={profileData.sections[selectedSection]}
                onChange={(updatedSection) =>
                  updateSection(
                    selectedSection,
                    updatedSection as ProfileSection
                  )
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                Select a section to edit or add a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface SectionEditorProps {
  t: Function
  section: ProfileSection
  onChange: (section: ProfileSection) => void
}

const SectionEditor: FC<SectionEditorProps> = ({ t, section, onChange }) => {
  switch (section.type) {
    case 'image-gallery':
      return <ImageGalleryEditor t={t} section={section} onChange={onChange} />
    case 'text':
      return <TextEditor t={t} section={section} onChange={onChange} />
    case 'links':
      return <LinksEditor t={t} section={section} onChange={onChange} />
    case 'skills':
      return <SkillsEditor t={t} section={section} onChange={onChange} />
    case 'experience':
      return <ExperienceEditor t={t} section={section} onChange={onChange} />
    case 'education':
      return <EducationEditor t={t} section={section} onChange={onChange} />
    case 'affiliation':
      return <AffiliationEditor t={t} section={section} onChange={onChange} />
    case 'courses':
      return <CoursesEditor t={t} section={section} onChange={onChange} />
    default:
      return <div>{t('Errors.unknownSectionType')}</div>
  }
}

const ImageGalleryEditor: FC<{
  t: Function
  section: ImageGallerySection
  onChange: (section: ImageGallerySection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <ImageIcon className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Image Gallery</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        {/* Images */}
        <div>
          <Label>Images</Label>
          <div className="mt-2 space-y-3">
            {section.images.map((image, index) => (
              <div
                key={index}
                className="grid grid-cols-[2fr_1fr_auto] gap-4 rounded-lg border p-4"
              >
                <div>
                  <Label>Image URL</Label>
                  <Input
                    value={image.url}
                    onChange={(e) => {
                      const newImages = [...section.images]
                      newImages[index] = { ...image, url: e.target.value }
                      onChange({ ...section, images: newImages })
                    }}
                    placeholder="Enter image URL"
                  />
                </div>
                <div>
                  <Label>Caption</Label>
                  <Input
                    value={image.caption || ''}
                    onChange={(e) => {
                      const newImages = [...section.images]
                      newImages[index] = { ...image, caption: e.target.value }
                      onChange({ ...section, images: newImages })
                    }}
                    placeholder="Image caption"
                  />
                </div>
                <div className="flex flex-col justify-between">
                  <Label>&nbsp;</Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newImages = section.images.filter(
                        (_, i) => i !== index
                      )
                      onChange({ ...section, images: newImages })
                    }}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {image.url && (
                  <div className="col-span-3">
                    <img
                      src={image.url}
                      alt={image.caption || ''}
                      className="mt-2 max-h-32 rounded-lg object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const newImage: ProfileImage = {
                  url: '',
                  caption: '',
                }
                onChange({
                  ...section,
                  images: [...section.images, newImage],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Image
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const TextEditor: FC<{
  t: Function
  section: TextSection
  onChange: (section: TextSection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <TextIcon className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Text Content</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        {/* Content */}
        <div>
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={section.content}
            onChange={(e) => onChange({ ...section, content: e.target.value })}
            placeholder="Enter your content here..."
            className="min-h-[200px]"
          />
        </div>
      </div>
    </div>
  )
}

const LinksEditor: FC<{
  t: Function
  section: LinksSection
  onChange: (section: LinksSection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <LinkIcon className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Links</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        {/* Links */}
        <div>
          <Label>Links</Label>
          <div className="mt-2 space-y-3">
            {section.links.map((link, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border p-4"
              >
                <Input
                  value={link.title}
                  onChange={(e) => {
                    const newLinks = [...section.links]
                    newLinks[index] = { ...link, title: e.target.value }
                    onChange({ ...section, links: newLinks })
                  }}
                  placeholder="Link title"
                />
                <Input
                  value={link.url}
                  onChange={(e) => {
                    const newLinks = [...section.links]
                    newLinks[index] = { ...link, url: e.target.value }
                    onChange({ ...section, links: newLinks })
                  }}
                  placeholder="URL"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newLinks = section.links.filter((_, i) => i !== index)
                    onChange({ ...section, links: newLinks })
                  }}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const newLink: ProfileLink = {
                  title: '',
                  url: '',
                }
                onChange({
                  ...section,
                  links: [...section.links, newLink],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Link
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const SkillsEditor: FC<{
  t: Function
  section: SkillsSection
  onChange: (section: SkillsSection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <Award className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Skills</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        {/* Skills */}
        <div>
          <Label>Skills</Label>
          <div className="mt-2 space-y-3">
            {section.skills.map((skill, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border p-4"
              >
                <Input
                  value={skill.name}
                  onChange={(e) => {
                    const newSkills = [...section.skills]
                    newSkills[index] = { ...skill, name: e.target.value }
                    onChange({ ...section, skills: newSkills })
                  }}
                  placeholder="Skill name"
                />
                <Select
                  value={skill.level || 'intermediate'}
                  onValueChange={(value) => {
                    const newSkills = [...section.skills]
                    newSkills[index] = {
                      ...skill,
                      level: value as ProfileSkill['level'],
                    }
                    onChange({ ...section, skills: newSkills })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={skill.category || ''}
                  onChange={(e) => {
                    const newSkills = [...section.skills]
                    newSkills[index] = { ...skill, category: e.target.value }
                    onChange({ ...section, skills: newSkills })
                  }}
                  placeholder="Category (optional)"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newSkills = section.skills.filter(
                      (_, i) => i !== index
                    )
                    onChange({ ...section, skills: newSkills })
                  }}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const newSkill: ProfileSkill = {
                  name: '',
                  level: 'intermediate',
                }
                onChange({
                  ...section,
                  skills: [...section.skills, newSkill],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Skill
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ExperienceEditor: FC<{
  t: Function
  section: ExperienceSection
  onChange: (section: ExperienceSection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <Briefcase className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Experience</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        {/* Experiences */}
        <div>
          <Label>Experience Items</Label>
          <div className="mt-2 space-y-4">
            {section.experiences.map((experience, index) => (
              <div key={index} className="space-y-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={experience.title}
                      onChange={(e) => {
                        const newExperiences = [...section.experiences]
                        newExperiences[index] = {
                          ...experience,
                          title: e.target.value,
                        }
                        onChange({ ...section, experiences: newExperiences })
                      }}
                      placeholder="Position or role"
                    />
                  </div>
                  <div>
                    <Label>Organization</Label>
                    <Input
                      value={experience.organization}
                      onChange={(e) => {
                        const newExperiences = [...section.experiences]
                        newExperiences[index] = {
                          ...experience,
                          organization: e.target.value,
                        }
                        onChange({ ...section, experiences: newExperiences })
                      }}
                      placeholder="Company or organization"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={experience.startDate}
                      onChange={(e) => {
                        const newExperiences = [...section.experiences]
                        newExperiences[index] = {
                          ...experience,
                          startDate: e.target.value,
                        }
                        onChange({ ...section, experiences: newExperiences })
                      }}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={experience.endDate || ''}
                      onChange={(e) => {
                        const newExperiences = [...section.experiences]
                        newExperiences[index] = {
                          ...experience,
                          endDate: e.target.value,
                        }
                        onChange({ ...section, experiences: newExperiences })
                      }}
                      disabled={experience.current}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`current-${index}`}
                        checked={experience.current}
                        onChange={(e) => {
                          const newExperiences = [...section.experiences]
                          newExperiences[index] = {
                            ...experience,
                            current: e.target.checked,
                            endDate: e.target.checked
                              ? undefined
                              : experience.endDate,
                          }
                          onChange({ ...section, experiences: newExperiences })
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`current-${index}`}>Current</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={experience.description}
                    onChange={(e) => {
                      const newExperiences = [...section.experiences]
                      newExperiences[index] = {
                        ...experience,
                        description: e.target.value,
                      }
                      onChange({ ...section, experiences: newExperiences })
                    }}
                    placeholder="Describe your role and achievements"
                    className="min-h-[100px]"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newExperiences = section.experiences.filter(
                        (_, i) => i !== index
                      )
                      onChange({ ...section, experiences: newExperiences })
                    }}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const newExperience: ProfileExperience = {
                  title: '',
                  organization: '',
                  startDate: new Date().toISOString().split('T')[0],
                  current: false,
                  description: '',
                }
                onChange({
                  ...section,
                  experiences: [...section.experiences, newExperience],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Experience
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const EducationEditor: FC<{
  t: Function
  section: EducationSection
  onChange: (section: EducationSection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <GraduationCap className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Education</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        {/* Education Items */}
        <div>
          <Label>Education Items</Label>
          <div className="mt-2 space-y-4">
            {section.education.map((edu, index) => (
              <div key={index} className="space-y-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Institution</Label>
                    <Input
                      value={edu.institution}
                      onChange={(e) => {
                        const newEducation = [...section.education]
                        newEducation[index] = {
                          ...edu,
                          institution: e.target.value,
                        }
                        onChange({ ...section, education: newEducation })
                      }}
                      placeholder="School or university"
                    />
                  </div>
                  <div>
                    <Label>Degree</Label>
                    <Input
                      value={edu.degree}
                      onChange={(e) => {
                        const newEducation = [...section.education]
                        newEducation[index] = {
                          ...edu,
                          degree: e.target.value,
                        }
                        onChange({ ...section, education: newEducation })
                      }}
                      placeholder="Degree type"
                    />
                  </div>
                </div>

                <div>
                  <Label>Field of Study</Label>
                  <Input
                    value={edu.field}
                    onChange={(e) => {
                      const newEducation = [...section.education]
                      newEducation[index] = { ...edu, field: e.target.value }
                      onChange({ ...section, education: newEducation })
                    }}
                    placeholder="Major or concentration"
                  />
                </div>

                <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={edu.startDate}
                      onChange={(e) => {
                        const newEducation = [...section.education]
                        newEducation[index] = {
                          ...edu,
                          startDate: e.target.value,
                        }
                        onChange({ ...section, education: newEducation })
                      }}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={edu.endDate || ''}
                      onChange={(e) => {
                        const newEducation = [...section.education]
                        newEducation[index] = {
                          ...edu,
                          endDate: e.target.value,
                        }
                        onChange({ ...section, education: newEducation })
                      }}
                      disabled={edu.current}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`current-edu-${index}`}
                        checked={edu.current}
                        onChange={(e) => {
                          const newEducation = [...section.education]
                          newEducation[index] = {
                            ...edu,
                            current: e.target.checked,
                            endDate: e.target.checked ? undefined : edu.endDate,
                          }
                          onChange({ ...section, education: newEducation })
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`current-edu-${index}`}>Current</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={edu.description || ''}
                    onChange={(e) => {
                      const newEducation = [...section.education]
                      newEducation[index] = {
                        ...edu,
                        description: e.target.value,
                      }
                      onChange({ ...section, education: newEducation })
                    }}
                    placeholder="Additional details about your education"
                    className="min-h-[100px]"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newEducation = section.education.filter(
                        (_, i) => i !== index
                      )
                      onChange({ ...section, education: newEducation })
                    }}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const newEducation: ProfileEducation = {
                  institution: '',
                  degree: '',
                  field: '',
                  startDate: new Date().toISOString().split('T')[0],
                  current: false,
                  description: '',
                }
                onChange({
                  ...section,
                  education: [...section.education, newEducation],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Education
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const AffiliationEditor: FC<{
  t: Function
  section: AffiliationSection
  onChange: (section: AffiliationSection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <MapPin className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Affiliation</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        {/* Affiliations */}
        <div>
          <Label>Affiliations</Label>
          <div className="mt-2 space-y-3">
            {section.affiliations.map((affiliation, index) => (
              <div key={index} className="space-y-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={affiliation.name}
                      onChange={(e) => {
                        const newAffiliations = [...section.affiliations]
                        newAffiliations[index] = {
                          ...affiliation,
                          name: e.target.value,
                        }
                        onChange({ ...section, affiliations: newAffiliations })
                      }}
                      placeholder="Name of the organization"
                    />
                  </div>
                  <div>
                    <Label>Logo URL</Label>
                    <Input
                      value={affiliation.logoUrl}
                      onChange={(e) => {
                        const newAffiliations = [...section.affiliations]
                        newAffiliations[index] = {
                          ...affiliation,
                          logoUrl: e.target.value,
                        }
                        onChange({ ...section, affiliations: newAffiliations })
                      }}
                      placeholder="URL to the organization's logo"
                    />
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={affiliation.description}
                    onChange={(e) => {
                      const newAffiliations = [...section.affiliations]
                      newAffiliations[index] = {
                        ...affiliation,
                        description: e.target.value,
                      }
                      onChange({ ...section, affiliations: newAffiliations })
                    }}
                    placeholder="Description of the organization"
                    className="min-h-[100px]"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const newAffiliations = section.affiliations.filter(
                        (_, i) => i !== index
                      )
                      onChange({ ...section, affiliations: newAffiliations })
                    }}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const newAffiliation: ProfileAffiliation = {
                  name: '',
                  description: '',
                  logoUrl: '',
                }
                onChange({
                  ...section,
                  affiliations: [...section.affiliations, newAffiliation],
                })
              }}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Affiliation
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CoursesEditor: FC<{
  t: Function
  section: CoursesSection
  onChange: (section: CoursesSection) => void
}> = ({ t, section, onChange }) => {
  return (
    <div className="nice-shadow space-y-6 rounded-lg bg-white p-6">
      <div className="flex items-center space-x-2">
        <BookOpen className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium">Courses</h3>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="title">Section Title</Label>
          <Input
            id="title"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="Enter section title"
          />
        </div>

        <div className="text-sm italic text-gray-500">
          Your authored courses will be automatically displayed in this section.
        </div>
      </div>
    </div>
  )
}

export default UserProfileBuilder
