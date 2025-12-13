import MainLayout from '@/src/components/layout/MainLayout';
import PdfUpload from '@/src/components/PdfUpload';

export default function Home() {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-50rem)]">
        <PdfUpload />
      </div>
    </MainLayout>
  );
}
