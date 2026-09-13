      isFlashSale: false,       // admin-only field — see firestore.rules
      discountPercent: 0,
      photos: [],
      createdAt: serverTimestamp()
    });

    // 2. Upload each photo to Storage under this seller's own folder.
    const photoUrls = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      submitBtn.textContent = `Uploading photo ${i + 1} of ${uploadedFiles.length}…`;
      const fileRef = ref(storage, `products/${currentUser.uid}/${productRef.id}/${i}.jpg`);
      await uploadBytes(fileRef, uploadedFiles[i]);
      photoUrls.push(await getDownloadURL(fileRef));
    }

    // 3. Attach the photo URLs to the product doc.
    await updateDoc(productRef, { photos: photoUrls });

    submitBtn.textContent = 'Submitted!';
    alert('Your product has been submitted for review. You\'ll be notified once approved.');
    window.location.href = 'index.html';

  } catch (err) {
    console.error(err);
    alert('Something went wrong submitting your product. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit for Review';
  }
}

// Expose the handlers this page's inline onclick= attributes call.
window.handleFiles = handleFiles;
window.removePhoto = removePhoto;
window.submitProduct = submitProduct;
