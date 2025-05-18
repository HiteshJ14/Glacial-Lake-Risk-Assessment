
import modin.pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, precision_score, recall_score, f1_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, AdaBoostClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier
from imblearn.over_sampling import SMOTE
from sklearn.preprocessing import FunctionTransformer

# Step 1: Load Dataset
csv_path = r"D:\sikkim_glof_filtered_data.csv"  # Replace with your file path
df = pd.read_csv(csv_path)

# Step 2: Preprocess Data
# Select relevant features for risk prediction
features = ['Lake_Area_km2', 'Mean_Elevation_m', 'Mean_Slope_deg']
target = 'Flood_Occurrence'

# Drop missing values
df = df.dropna(subset=features + [target])

# Prepare features (X) and target (y)
X = df[features]
y = (df[target] > 0.05).astype(int)  # Classify as High Risk (1) if Flood_Occurrence > 0.05

# Add interaction terms to capture feature relationships
X['Area_Elevation_Interaction'] = X['Lake_Area_km2'] * X['Mean_Elevation_m']
X['Area_Slope_Interaction'] = X['Lake_Area_km2'] * X['Mean_Slope_deg']

# Log-transform skewed features
transformer = FunctionTransformer(np.log1p, validate=True)
X[['Lake_Area_km2', 'Mean_Elevation_m']] = transformer.transform(X[['Lake_Area_km2', 'Mean_Elevation_m']])

# Handle Imbalance using SMOTE
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X, y)

# Normalize feature values
X_normalized = (X_resampled - X_resampled.mean()) / X_resampled.std()

# Step 3: Train-Test Split
X_train, X_test, y_train, y_test = train_test_split(X_normalized, y_resampled, test_size=0.2, random_state=42, stratify=y_resampled)

# Step 4: Define Classifiers
classifiers = {
    'Logistic Regression': LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42),
    'Random Forest': RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42),
    'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
    'XGBoost': XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=42),
    'LightGBM': LGBMClassifier(random_state=42),
    'CatBoost': CatBoostClassifier(verbose=0, random_state=42),
    'KNN': KNeighborsClassifier(n_neighbors=5),
    'SVM': SVC(kernel='rbf', probability=True, random_state=42),
    'Naive Bayes': GaussianNB(),
    'Decision Tree': DecisionTreeClassifier(class_weight='balanced', random_state=42),
    'AdaBoost': AdaBoostClassifier(n_estimators=100, random_state=42)
}

# Step 5: Evaluate and Store Results
results = []

for clf_name, clf in classifiers.items():
    print(f"Training and evaluating: {clf_name}")
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    
    # Calculate metrics
    acc = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    
    # Append results
    results.append({
        'Classifier': clf_name,
        'Accuracy': acc,
        'Precision': precision,
        'Recall': recall,
        'F1-Score': f1
    })

# Convert results to DataFrame
results_df = pd.DataFrame(results)

# Save results to Excel
excel_path = "Classifier_Comparison_Results.xlsx"
results_df.to_excel(excel_path, index=False)
print(f"Results saved to {excel_path}.")
