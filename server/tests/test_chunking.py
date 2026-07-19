import unittest

from app.chunking import chunk_text


class ChunkingTests(unittest.TestCase):
    def test_chunks_preserve_content_and_overlap(self):
        text = ('第一段。' * 120) + '\n\n' + ('第二段。' * 120)
        chunks = chunk_text(text, chunk_size=400, overlap=80)
        self.assertGreater(len(chunks), 2)
        self.assertEqual([chunk.ordinal for chunk in chunks], list(range(len(chunks))))
        self.assertTrue(all(0 < len(chunk.content) <= 500 for chunk in chunks))

    def test_blank_text_has_no_chunks(self):
        self.assertEqual(chunk_text(' \n\n '), [])


if __name__ == '__main__':
    unittest.main()
