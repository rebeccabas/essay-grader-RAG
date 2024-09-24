import os
import faiss
import numpy as np
import pandas as pd
import pickle
from openai import OpenAI
from dotenv import load_dotenv
from sklearn.preprocessing import normalize

# Load environment variables from .env file
load_dotenv()

# Set up OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_embedding(text, model="text-embedding-3-small"):
    text = text.replace("\n", " ")
    return client.embeddings.create(input=[text], model=model).data[0].embedding

def load_essays_from_csv(csv_file):
    return pd.read_csv(csv_file)

def store_essays_in_faiss(df):
    dimension = 1536  # Dimension of text-embedding-ada-002
    index = faiss.IndexFlatL2(dimension)
    essay_embeddings = []
    essay_metadata = []

    for i, row in df.iterrows():
        essay_text = row['essay']
        essay_vector = get_embedding(essay_text, model="text-embedding-ada-002")
        essay_vector = np.array(essay_vector).reshape(1, -1).astype('float32')
        essay_vector = normalize(essay_vector)

        essay_embeddings.append(essay_vector)
        essay_metadata.append(row.to_dict())
        index.add(essay_vector)

    return index, essay_embeddings, essay_metadata

def save_faiss_index(index, filename):
    faiss.write_index(index, filename)

def save_metadata(metadata, filename):
    with open(filename, 'wb') as f:
        pickle.dump(metadata, f)

if __name__ == "__main__":
    csv_file = 'essay_set_7.csv'
    index_file = 'essay_index.faiss'
    metadata_file = 'essay_metadata.pkl'

    essays_df = load_essays_from_csv(csv_file)
    index, _, essay_metadata = store_essays_in_faiss(essays_df)
    save_faiss_index(index, index_file)
    save_metadata(essay_metadata, metadata_file)

    print("FAISS index and metadata have been created and saved.")